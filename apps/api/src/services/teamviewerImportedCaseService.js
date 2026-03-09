const repository = require('../repositories/teamviewerImportedCaseRepository');
const { fetchConnectionReports } = require('./teamviewerApiClient');
const { httpError } = require('../utils/httpError');

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
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
  const note = String(noteRaw || '').trim();
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

  const fromIso = fromDate.toISOString();
  const toIso = toDate.toISOString();
  if (fromDate > toDate) {
    throw httpError(400, 'from_date must be less than or equal to to_date');
  }

  return { from_date: fromIso, to_date: toIso };
}

function normalizeListFilters(filters = {}) {
  const normalized = {
    from_date: null,
    to_date: null,
    location_id: null,
    group: isBlank(filters.group) ? null : String(filters.group).trim(),
    technician: isBlank(filters.technician) ? null : String(filters.technician).trim(),
    keyword: isBlank(filters.keyword) ? null : String(filters.keyword).trim()
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
  const externalConnectionId = isBlank(externalConnectionIdRaw) ? null : String(externalConnectionIdRaw).trim();

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
  const noteRaw = isBlank(noteRawCandidate) ? '' : String(noteRawCandidate).trim();

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
    : String(teamviewerGroupNameCandidate).trim();

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
    technician_username: isBlank(technicianUsernameCandidate) ? null : String(technicianUsernameCandidate).trim(),
    technician_display_name: isBlank(technicianDisplayNameCandidate)
      ? null
      : String(technicianDisplayNameCandidate).trim(),
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
  const rawConnections = await fetchConnectionReports(range);
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
    rowsToInsert.push({
      ...normalized,
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
    range,
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

  const teamviewerGroupName = String(payload.teamviewer_group_name || '').trim();
  if (!teamviewerGroupName) {
    throw httpError(400, 'teamviewer_group_name is required');
  }

  const noteRaw = String(payload.note_raw || '').trim();
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
    technician_username: isBlank(payload.technician_username) ? null : String(payload.technician_username).trim(),
    technician_display_name: isBlank(payload.technician_display_name)
      ? null
      : String(payload.technician_display_name).trim(),
    teamviewer_group_name: teamviewerGroupName,
    note_raw: noteRaw,
    problem_description: parsed.problem_description,
    requested_by: parsed.requested_by,
    location_id: isBlank(payload.location_id) ? null : Number(payload.location_id),
    linked_incident_id: null,
    raw_payload_json: isBlank(payload.raw_payload_json) ? null : String(payload.raw_payload_json)
  });
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
  getImportedCaseById,
  createManualImportedCase,
  deleteImportedCase,
  parseNoteStrict
};
