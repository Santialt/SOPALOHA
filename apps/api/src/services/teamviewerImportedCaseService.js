const repository = require('../repositories/teamviewerImportedCaseRepository');
const userRepository = require('../repositories/userRepository');
const { fetchConnectionReports, fetchGroups } = require('./teamviewerApiClient');
const { httpError } = require('../utils/httpError');
const { hashPassword } = require('../utils/passwords');
const crypto = require('crypto');

const IMPORTED_TEAMVIEWER_TECHNICIANS = [
  {
    aliases: ['jpascuini'],
    name: 'Jpascuini',
    email: 'jpascuini@teamviewer.local'
  },
  {
    aliases: ['santiago altamirano', 'santiago.altamirano'],
    name: 'Santiago Altamirano',
    email: 'santiago.altamirano@teamviewer.local'
  },
  {
    aliases: ['uriel granero', 'uriel.granero'],
    name: 'Uriel Granero',
    email: 'uriel.granero@teamviewer.local'
  }
];

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function sanitizeText(value) {
  return Array.from(String(value || ''))
    .map((char) => {
      const code = char.charCodeAt(0);
      return (code <= 31 || code === 127) ? ' ' : char;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLookupKey(value) {
  return sanitizeText(value).toLowerCase();
}

function pickFirst(source, candidateKeys) {
  const sourceObject = source || {};

  for (const key of candidateKeys) {
    const value = sourceObject[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  const keyMap = new Map();
  for (const key of Object.keys(sourceObject)) {
    keyMap.set(String(key).toLowerCase(), key);
  }

  for (const key of candidateKeys) {
    const match = keyMap.get(String(key).toLowerCase());
    if (match) {
      const value = sourceObject[match];
      if (value !== undefined && value !== null) {
        return value;
      }
    }
  }

  return null;
}

function normalizeDateTime(value) {
  if (isBlank(value)) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeDurationSeconds(value, startedAt, endedAt) {
  if (!isBlank(value)) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.round(parsed);
    }
  }

  if (startedAt && endedAt) {
    const diffMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
    if (Number.isFinite(diffMs) && diffMs >= 0) {
      return Math.round(diffMs / 1000);
    }
  }

  return null;
}

function parseNoteStrict(noteRaw) {
  const note = sanitizeText(noteRaw);
  if (!note) {
    return { valid: false, reason: 'empty_note' };
  }

  const separator = ' - ';
  const separatorIndex = note.lastIndexOf(separator);
  if (separatorIndex <= 0) {
    return { valid: false, reason: 'missing_separator' };
  }

  const left = note.slice(0, separatorIndex).trim();
  const right = note.slice(separatorIndex + separator.length).trim();

  if (!left || !right) {
    return { valid: false, reason: 'invalid_note_segments' };
  }

  return {
    valid: true,
    problem_description: left,
    requested_by: right
  };
}

function normalizeImportRange(payload = {}) {
  const fromRaw = payload.from_date ?? payload.fromDate ?? payload.start_date ?? payload.startDate;
  const toRaw = payload.to_date ?? payload.toDate ?? payload.end_date ?? payload.endDate;

  if (isBlank(fromRaw) || isBlank(toRaw)) {
    throw httpError(400, 'Fields from_date and to_date are required');
  }

  const fromDate = parseDateRangeEdge(fromRaw, false);
  const toDate = parseDateRangeEdge(toRaw, true);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw httpError(400, 'Invalid date range. Use ISO date or datetime values');
  }

  if (fromDate > toDate) {
    throw httpError(400, 'from_date must be less than or equal to to_date');
  }

  return {
    from_date: fromDate.toISOString(),
    to_date: toDate.toISOString(),
    api_from_date: fromDate.toISOString().slice(0, 10),
    api_to_date: toDate.toISOString().slice(0, 10)
  };
}

function normalizeListFilters(filters = {}) {
  const normalized = {
    from_date: null,
    to_date: null,
    location_id: null,
    group: isBlank(filters.group) ? null : sanitizeText(filters.group),
    technician_user_id: null,
    keyword: isBlank(filters.keyword) ? null : sanitizeText(filters.keyword)
  };

  if (!isBlank(filters.from_date)) {
    const fromDate = parseDateRangeEdge(filters.from_date, false);
    if (Number.isNaN(fromDate.getTime())) {
      throw httpError(400, 'Invalid from_date filter');
    }
    normalized.from_date = fromDate.toISOString();
  }

  if (!isBlank(filters.to_date)) {
    const toDate = parseDateRangeEdge(filters.to_date, true);
    if (Number.isNaN(toDate.getTime())) {
      throw httpError(400, 'Invalid to_date filter');
    }
    normalized.to_date = toDate.toISOString();
  }

  if (!isBlank(filters.location_id)) {
    const locationId = Number(filters.location_id);
    if (!Number.isInteger(locationId)) {
      throw httpError(400, 'location_id filter must be an integer');
    }
    normalized.location_id = locationId;
  }

  if (!isBlank(filters.technician_user_id)) {
    const technicianUserId = Number(filters.technician_user_id);
    if (!Number.isInteger(technicianUserId)) {
      throw httpError(400, 'technician_user_id filter must be an integer');
    }

    const technician = userRepository.findById(technicianUserId);
    if (!technician || !technician.active || technician.role !== 'tech') {
      throw httpError(400, 'technician_user_id filter must reference an active tech user');
    }

    normalized.technician_user_id = technicianUserId;
    normalized.technician_name = technician.name;
    normalized.technician_email = technician.email;
  }

  if (!isBlank(filters.limit)) {
    const limit = Number(filters.limit);
    if (!Number.isInteger(limit) || limit <= 0) {
      throw httpError(400, 'limit filter must be a positive integer');
    }
    normalized.limit = Math.min(limit, 200);
  }

  if (!isBlank(filters.offset)) {
    const offset = Number(filters.offset);
    if (!Number.isInteger(offset) || offset < 0) {
      throw httpError(400, 'offset filter must be a non-negative integer');
    }
    normalized.offset = offset;
  }

  return normalized;
}

function parseDateRangeEdge(value, endOfDay) {
  const raw = String(value || '').trim();
  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (dateOnlyPattern.test(raw)) {
    const suffix = endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
    return new Date(`${raw}${suffix}`);
  }
  return new Date(raw);
}

function slugifyEmailLocalPart(value) {
  const normalized = normalizeLookupKey(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');

  return normalized || 'teamviewer.tech';
}

function findImportedTechnicianProfile(technicianDisplayName, technicianUsername) {
  const candidateKeys = [technicianDisplayName, technicianUsername]
    .map((value) => normalizeLookupKey(value))
    .filter(Boolean);

  for (const profile of IMPORTED_TEAMVIEWER_TECHNICIANS) {
    const profileAliases = profile.aliases.map((alias) => normalizeLookupKey(alias));
    if (candidateKeys.some((key) => profileAliases.includes(key))) {
      return profile;
    }
  }

  if (!candidateKeys.length) {
    return null;
  }

  const preferredName = sanitizeText(technicianDisplayName) || sanitizeText(technicianUsername);
  if (!preferredName) {
    return null;
  }

  return {
    aliases: candidateKeys,
    name: preferredName,
    email: `${slugifyEmailLocalPart(preferredName)}@teamviewer.local`
  };
}

function createDisabledImportedUser(profile) {
  return userRepository.create({
    name: profile.name,
    email: profile.email,
    password_hash: hashPassword(crypto.randomBytes(48).toString('hex')),
    role: 'tech',
    active: false
  });
}

function findOrCreateImportedTechnician(normalizedCase) {
  const profile = findImportedTechnicianProfile(
    normalizedCase.technician_display_name,
    normalizedCase.technician_username
  );
  if (!profile) {
    return null;
  }

  const byEmail = userRepository.findByEmail(profile.email);
  if (byEmail) {
    return byEmail;
  }

  return createDisabledImportedUser(profile);
}

function normalizeRawConnection(rawConnection) {
  const externalConnectionIdRaw = pickFirst(rawConnection, [
    'id',
    'connection_id',
    'connectionId',
    'session_id',
    'sessionId',
    'report_id',
    'reportId'
  ]);
  const externalConnectionId = isBlank(externalConnectionIdRaw) ? null : sanitizeText(externalConnectionIdRaw);

  const startedAt = normalizeDateTime(
    pickFirst(rawConnection, [
      'start_time',
      'startTime',
      'started_at',
      'startedAt',
      'connection_start',
      'start_date',
      'startDate',
      'start'
    ])
  );
  const endedAt = normalizeDateTime(
    pickFirst(rawConnection, [
      'end_time',
      'endTime',
      'ended_at',
      'endedAt',
      'connection_end',
      'end_date',
      'endDate',
      'end'
    ])
  );

  const noteRawCandidate = pickFirst(rawConnection, ['note', 'notes', 'comment', 'description', 'COMMENTS', 'COMMENT']);
  const noteRaw = isBlank(noteRawCandidate) ? '' : sanitizeText(noteRawCandidate);

  const teamviewerGroupNameCandidate = pickFirst(rawConnection, [
    'group_name',
    'groupName',
    'groupname',
    'group',
    'device_group_name',
    'deviceGroupName',
    'teamviewer_group_name',
    'teamviewerGroupName'
  ]);
  const teamviewerGroupName = isBlank(teamviewerGroupNameCandidate)
    ? null
    : sanitizeText(teamviewerGroupNameCandidate);

  const technicianUsernameCandidate = pickFirst(rawConnection, [
    'technician_username',
    'technicianUsername',
    'user_name',
    'userid',
    'user'
  ]);
  const technicianDisplayNameCandidate = pickFirst(rawConnection, [
    'technician_display_name',
    'technicianDisplayName',
    'technician_name',
    'technicianName',
    'display_name',
    'displayName',
    'username',
    'USER',
    'partner_name',
    'partnerName'
  ]);

  const durationSeconds = normalizeDurationSeconds(
    pickFirst(rawConnection, ['duration_seconds', 'durationSeconds', 'duration']),
    startedAt,
    endedAt
  );

  return {
    external_connection_id: externalConnectionId,
    started_at: startedAt,
    ended_at: endedAt,
    duration_seconds: durationSeconds,
    technician_username: isBlank(technicianUsernameCandidate) ? null : sanitizeText(technicianUsernameCandidate),
    technician_display_name: isBlank(technicianDisplayNameCandidate)
      ? null
      : sanitizeText(technicianDisplayNameCandidate),
    technician_user_id: null,
    teamviewer_group_name: teamviewerGroupName,
    note_raw: noteRaw,
    location_id: null,
    linked_incident_id: null,
    raw_payload_json: JSON.stringify(rawConnection)
  };
}

async function importCases(payload = {}) {
  const range = normalizeImportRange(payload);
  const rangeStartMs = new Date(range.from_date).getTime();
  const rangeEndMs = new Date(range.to_date).getTime();
  const rawConnections = await fetchConnectionReports({
    from_date: range.api_from_date,
    to_date: range.api_to_date
  });
  const connectionsInRange = rawConnections.filter((rawConnection) => {
    const startedAt = normalizeDateTime(
      pickFirst(rawConnection, [
        'start_time',
        'startTime',
        'started_at',
        'startedAt',
        'connection_start',
        'start_date',
        'startDate',
        'start'
      ])
    );
    if (!startedAt) return false;
    const startedMs = new Date(startedAt).getTime();
    return startedMs >= rangeStartMs && startedMs <= rangeEndMs;
  });

  const stats = {
    total_received: connectionsInRange.length,
    total_with_note: 0,
    total_valid_format: 0,
    total_inserted: 0,
    total_duplicated: 0,
    total_discarded_invalid_format: 0,
    total_out_of_range_from_api: rawConnections.length - connectionsInRange.length
  };

  const discarded = [];
  const rowsToInsert = [];
  const seenExternalIds = new Set();
  let duplicatedInPayload = 0;

  for (const rawConnection of connectionsInRange) {
    const normalized = normalizeRawConnection(rawConnection);

    if (isBlank(normalized.note_raw)) {
      continue;
    }
    stats.total_with_note += 1;

    const parsed = parseNoteStrict(normalized.note_raw);
    if (!parsed.valid) {
      stats.total_discarded_invalid_format += 1;
      discarded.push({
        external_connection_id: normalized.external_connection_id,
        reason: parsed.reason
      });
      continue;
    }

    if (isBlank(normalized.external_connection_id) || isBlank(normalized.started_at) || isBlank(normalized.teamviewer_group_name)) {
      stats.total_discarded_invalid_format += 1;
      discarded.push({
        external_connection_id: normalized.external_connection_id,
        reason: 'missing_required_fields'
      });
      continue;
    }

    if (seenExternalIds.has(normalized.external_connection_id)) {
      duplicatedInPayload += 1;
      continue;
    }
    seenExternalIds.add(normalized.external_connection_id);

    stats.total_valid_format += 1;
    const technicianUser = findOrCreateImportedTechnician(normalized);
    rowsToInsert.push({
      ...normalized,
      technician_user_id: technicianUser?.id || null,
      technician_display_name: technicianUser?.name || normalized.technician_display_name,
      technician_username: technicianUser?.email || normalized.technician_username,
      problem_description: parsed.problem_description,
      requested_by: parsed.requested_by
    });
  }

  const insertResult = repository.insertMany(rowsToInsert);
  stats.total_inserted = insertResult.inserted;
  stats.total_duplicated = insertResult.duplicated + duplicatedInPayload;

  console.info(
    `[TeamViewer Imported Cases] received=${stats.total_received} with_note=${stats.total_with_note} valid=${stats.total_valid_format} inserted=${stats.total_inserted} duplicated=${stats.total_duplicated} invalid_format=${stats.total_discarded_invalid_format}`
  );

  return {
    imported_at: new Date().toISOString(),
    range: {
      from_date: range.from_date,
      to_date: range.to_date
    },
    summary: stats,
    discarded
  };
}

function listImportedCases(filters = {}) {
  const normalizedFilters = normalizeListFilters(filters);
  return repository.findAll(normalizedFilters);
}

function getImportedCaseById(id) {
  const row = repository.findById(id);
  if (!row) {
    throw httpError(404, 'Imported TeamViewer case not found');
  }
  return row;
}

function normalizeManualStartedAt(value) {
  const parsed = normalizeDateTime(value);
  if (!parsed) {
    throw httpError(400, 'started_at is required and must be a valid datetime');
  }
  return parsed;
}

function createManualImportedCase(payload = {}) {
  const startedAt = normalizeManualStartedAt(payload.started_at);
  const endedAt = isBlank(payload.ended_at) ? null : normalizeDateTime(payload.ended_at);
  if (!isBlank(payload.ended_at) && !endedAt) {
    throw httpError(400, 'ended_at must be a valid datetime');
  }

  const teamviewerGroupName = sanitizeText(payload.teamviewer_group_name);
  if (!teamviewerGroupName) {
    throw httpError(400, 'teamviewer_group_name is required');
  }

  const technicianUserId = Number(payload.technician_user_id);
  if (!Number.isInteger(technicianUserId)) {
    throw httpError(400, 'technician_user_id is required and must be an integer');
  }

  const technician = userRepository.findById(technicianUserId);
  if (!technician || !technician.active || technician.role !== 'tech') {
    throw httpError(400, 'technician_user_id must reference an active tech user');
  }

  const noteRaw = sanitizeText(payload.note_raw);
  const parsed = parseNoteStrict(noteRaw);
  if (!parsed.valid) {
    throw httpError(400, `Invalid note format: ${parsed.reason}`);
  }

  const manualId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return repository.create({
    external_connection_id: manualId,
    started_at: startedAt,
    ended_at: endedAt,
    duration_seconds: normalizeDurationSeconds(payload.duration_seconds, startedAt, endedAt),
    technician_username: sanitizeText(technician.email),
    technician_display_name: sanitizeText(technician.name),
    technician_user_id: technician.id,
    teamviewer_group_name: teamviewerGroupName,
    note_raw: noteRaw,
    problem_description: parsed.problem_description,
    requested_by: parsed.requested_by,
    location_id: isBlank(payload.location_id) ? null : Number(payload.location_id),
    linked_incident_id: null,
    raw_payload_json: isBlank(payload.raw_payload_json) ? null : String(payload.raw_payload_json)
  });
}

let teamviewerGroupsCache = {
  loaded_at: null,
  groups: []
};

const TEAMVIEWER_GROUPS_CACHE_TTL_MS = 5 * 60 * 1000;

function buildPersistedGroupIndex() {
  const index = new Map();
  for (const row of repository.findDistinctGroups()) {
    index.set(String(row.teamviewer_group_name || '').trim().toLowerCase(), row);
  }
  return index;
}

function normalizeCatalogGroup(rawGroup, persistedGroupIndex) {
  const groupName = sanitizeText(rawGroup?.name ?? rawGroup?.group_name ?? rawGroup?.alias);
  if (!groupName) return null;

  const persisted = persistedGroupIndex.get(groupName.toLowerCase());
  return {
    group_name: groupName,
    location_id: persisted?.location_id || null,
    location_name: persisted?.location_name || null,
    source: 'teamviewer'
  };
}

async function listImportedCaseCatalogs() {
  const technicians = userRepository.findActiveTechnicians();
  const persistedGroups = repository.findDistinctGroups().map((row) => ({
    group_name: row.teamviewer_group_name,
    location_id: row.location_id || null,
    location_name: row.location_name || null,
    source: 'persisted'
  }));
  const persistedGroupIndex = buildPersistedGroupIndex();

  let groups = [...persistedGroups];
  let source = persistedGroups.length > 0 ? 'persisted' : 'empty';
  const now = Date.now();
  const cacheFresh =
    teamviewerGroupsCache.loaded_at && now - teamviewerGroupsCache.loaded_at < TEAMVIEWER_GROUPS_CACHE_TTL_MS;

  try {
    if (cacheFresh) {
      groups = teamviewerGroupsCache.groups;
      source = 'teamviewer_cache';
    } else {
      const fetchedGroups = (await fetchGroups())
        .map((group) => normalizeCatalogGroup(group, persistedGroupIndex))
        .filter(Boolean);

      if (fetchedGroups.length > 0) {
        const deduped = new Map();
        for (const group of [...fetchedGroups, ...persistedGroups]) {
          const key = group.group_name.toLowerCase();
          if (!deduped.has(key)) {
            deduped.set(key, group);
          }
        }

        groups = [...deduped.values()].sort((a, b) => a.group_name.localeCompare(b.group_name, 'es', { sensitivity: 'base' }));
        source = 'teamviewer';
        teamviewerGroupsCache = {
          loaded_at: now,
          groups
        };
      }
    }
  } catch (error) {
    if (groups.length === 0) {
      throw error;
    }
  }

  return {
    technicians,
    teamviewer_groups: groups,
    teamviewer_groups_source: source
  };
}

function deleteImportedCase(id) {
  const deleted = repository.remove(id);
  if (!deleted) {
    throw httpError(404, 'Imported TeamViewer case not found');
  }
}

module.exports = {
  importCases,
  listImportedCases,
  listImportedCaseCatalogs,
  getImportedCaseById,
  createManualImportedCase,
  deleteImportedCase,
  parseNoteStrict
};
