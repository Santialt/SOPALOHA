const db = require('../db/connection');
const { fetchDevices, fetchGroups } = require('./teamviewerApiClient');

const ROLE_RULES = [
  { role: 'server', patterns: ['server', 'servidor', 'srv'] },
  { role: 'pos', patterns: ['caja', 'pos', 'terminal', 'term'] }
];

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeKey(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeNumericId(value) {
  return String(value || '').replace(/\D+/g, '').trim();
}

function detectDeviceRole(alias) {
  const normalized = normalizeKey(alias);

  for (const rule of ROLE_RULES) {
    if (rule.patterns.some((pattern) => normalized.includes(pattern))) {
      return rule.role;
    }
  }

  return 'other';
}

function resolveTeamviewerId(rawDevice) {
  const remoteControlRaw = rawDevice.remotecontrol_id ?? rawDevice.remoteControlId;
  const remoteControlId = normalizeNumericId(remoteControlRaw);
  if (remoteControlId) {
    return {
      value: remoteControlId,
      source: 'remotecontrol_id',
      reliable: true
    };
  }

  const deviceIdRaw = rawDevice.device_id ?? rawDevice.deviceId ?? rawDevice.id;
  const deviceId = normalizeString(deviceIdRaw);
  if (deviceId) {
    return {
      value: deviceId,
      source: 'device_id_fallback',
      reliable: true
    };
  }

  return {
    value: null,
    source: 'missing',
    reliable: false
  };
}

function buildExistingLocationsMap() {
  const rows = db.prepare('SELECT id, name FROM locations').all();
  const byName = new Map();

  for (const row of rows) {
    byName.set(normalizeKey(row.name), row);
  }

  return byName;
}

function buildExistingDeviceMaps() {
  const rows = db
    .prepare(
      `SELECT d.id, d.name, d.teamviewer_id, d.location_id, l.name AS location_name
       FROM devices d
       JOIN locations l ON l.id = d.location_id`
    )
    .all();

  const byTeamviewerId = new Map();
  const byFallbackKey = new Map();

  for (const row of rows) {
    const normalizedTvId = normalizeString(row.teamviewer_id);
    if (normalizedTvId) {
      byTeamviewerId.set(normalizedTvId, row);
    } else {
      const fallbackKey = `${normalizeKey(row.location_name)}::${normalizeKey(row.name)}`;
      if (!byFallbackKey.has(fallbackKey)) {
        byFallbackKey.set(fallbackKey, row);
      }
    }
  }

  return { byTeamviewerId, byFallbackKey };
}

function normalizeGroupId(rawGroup) {
  return normalizeString(rawGroup.id ?? rawGroup.groupid ?? rawGroup.group_id ?? rawGroup.groupId);
}

function normalizeGroupName(rawGroup) {
  return normalizeString(rawGroup.name ?? rawGroup.alias ?? rawGroup.group_name ?? rawGroup.groupName);
}

function normalizeDeviceGroupId(rawDevice) {
  return normalizeString(rawDevice.groupid ?? rawDevice.group_id ?? rawDevice.groupId);
}

function normalizeDeviceAlias(rawDevice) {
  const alias = normalizeString(rawDevice.alias ?? rawDevice.name ?? rawDevice.device_name);
  if (alias) return alias;
  const rawId = normalizeString(rawDevice.device_id ?? rawDevice.id);
  return rawId ? `Device ${rawId}` : 'Device without alias';
}

function getTeamviewerSnapshotSummary(rawGroups, rawDevices) {
  return {
    groups_total: rawGroups.length,
    devices_total: rawDevices.length
  };
}

async function loadTeamviewerSnapshot() {
  const [rawGroups, rawDevices] = await Promise.all([fetchGroups(), fetchDevices()]);

  const groupsById = new Map();
  const groups = [];

  for (const rawGroup of rawGroups) {
    const groupId = normalizeGroupId(rawGroup);
    const groupName = normalizeGroupName(rawGroup);
    if (!groupId || !groupName) continue;

    const group = { group_id: groupId, group_name: groupName };
    groupsById.set(groupId, group);
    groups.push(group);
  }

  return {
    groups,
    groupsById,
    rawDevices,
    summary: getTeamviewerSnapshotSummary(rawGroups, rawDevices)
  };
}

function buildImportPreviewFromSnapshot(snapshot) {
  const existingLocationsByName = buildExistingLocationsMap();
  const existingDeviceMaps = buildExistingDeviceMaps();
  const warnings = [];
  const previewGroups = [];
  const previewDevices = [];

  const newLocationNames = new Set();
  const reusedLocationNames = new Set();

  for (const group of snapshot.groups) {
    const locationKey = normalizeKey(group.group_name);
    const existingLocation = existingLocationsByName.get(locationKey);
    const status = existingLocation ? 'reused' : 'new';

    if (status === 'new') {
      newLocationNames.add(locationKey);
    } else {
      reusedLocationNames.add(locationKey);
    }

    previewGroups.push({
      group_id: group.group_id,
      group_name: group.group_name,
      location_name: group.group_name,
      location_status: status,
      location_id: existingLocation?.id || null
    });
  }

  const seenTeamviewerIds = new Set();
  const seenFallbackKeys = new Set();

  for (const rawDevice of snapshot.rawDevices) {
    const groupId = normalizeDeviceGroupId(rawDevice);
    const group = snapshot.groupsById.get(groupId);
    const alias = normalizeDeviceAlias(rawDevice);
    const resolvedId = resolveTeamviewerId(rawDevice);
    const role = detectDeviceRole(alias);

    if (!group) {
      warnings.push(`Device "${alias}" skipped in preview: unknown groupid "${groupId || 'empty'}".`);
      continue;
    }

    const locationName = group.group_name;
    const fallbackKey = `${normalizeKey(locationName)}::${normalizeKey(alias)}`;
    let status = 'new';
    let statusReason = 'No duplicates found';

    if (resolvedId.value) {
      if (existingDeviceMaps.byTeamviewerId.has(resolvedId.value)) {
        status = 'duplicate';
        statusReason = 'Existing device with same teamviewer_id';
      } else if (seenTeamviewerIds.has(resolvedId.value)) {
        status = 'duplicate';
        statusReason = 'Duplicated teamviewer_id in TeamViewer payload';
      } else {
        seenTeamviewerIds.add(resolvedId.value);
      }
    } else if (existingDeviceMaps.byFallbackKey.has(fallbackKey)) {
      status = 'duplicate';
      statusReason = 'Fallback duplicate by location + alias';
    } else if (seenFallbackKeys.has(fallbackKey)) {
      status = 'duplicate';
      statusReason = 'Duplicated location + alias in TeamViewer payload';
    } else {
      seenFallbackKeys.add(fallbackKey);
      statusReason = 'No teamviewer_id; using fallback key location+alias';
    }

    previewDevices.push({
      alias,
      group_id: group.group_id,
      group_name: group.group_name,
      location_name: locationName,
      teamviewer_id: resolvedId.value,
      teamviewer_id_source: resolvedId.source,
      role,
      status,
      status_reason: statusReason
    });
  }

  const preview = {
    generated_at: new Date().toISOString(),
    summary: {
      ...snapshot.summary,
      locations_to_create: newLocationNames.size,
      locations_to_reuse: reusedLocationNames.size,
      devices_to_create: previewDevices.filter((row) => row.status === 'new').length,
      devices_duplicates: previewDevices.filter((row) => row.status === 'duplicate').length,
      warnings: warnings.length
    },
    id_strategy: {
      primary: 'remotecontrol_id',
      fallback: 'device_id',
      notes: 'remotecontrol_id is normalized to digits and used for operational TeamViewer open actions.'
    },
    groups: previewGroups,
    devices: previewDevices,
    warnings
  };

  return preview;
}

async function buildImportPreview() {
  const snapshot = await loadTeamviewerSnapshot();
  return buildImportPreviewFromSnapshot(snapshot);
}

function createLocationIfMissing(locationName) {
  const existing = db
    .prepare('SELECT id, name FROM locations WHERE lower(trim(name)) = lower(trim(?))')
    .get(locationName);

  if (existing) {
    return { location: existing, created: false };
  }

  const insertResult = db
    .prepare('INSERT INTO locations (name) VALUES (?)')
    .run(locationName);

  const location = db.prepare('SELECT id, name FROM locations WHERE id = ?').get(insertResult.lastInsertRowid);
  return { location, created: true };
}

function deviceExistsByTeamviewerId(teamviewerId) {
  return db.prepare('SELECT id FROM devices WHERE teamviewer_id = ?').get(teamviewerId);
}

function deviceExistsByFallback(locationId, alias) {
  return db
    .prepare(
      `SELECT id
       FROM devices
       WHERE location_id = ?
         AND lower(trim(name)) = lower(trim(?))
         AND (teamviewer_id IS NULL OR trim(teamviewer_id) = '')`
    )
    .get(locationId, alias);
}

function insertImportedDevice(row, locationId) {
  const result = db
    .prepare(
      `INSERT INTO devices (location_id, name, type, device_role, teamviewer_id)
       VALUES (?, ?, 'other', ?, ?)`
    )
    .run(locationId, row.alias, row.role, row.teamviewer_id || null);

  return result.lastInsertRowid;
}

async function runImport() {
  const snapshot = await loadTeamviewerSnapshot();
  const preview = buildImportPreviewFromSnapshot(snapshot);

  const locationsCreated = [];
  const locationsReused = [];
  const devicesCreated = [];
  const devicesSkippedDuplicate = [];
  const warnings = [...preview.warnings];

  const importTransaction = db.transaction(() => {
    const locationIdByName = new Map();
    const processedLocationNames = new Set();

    for (const row of preview.groups) {
      const locationKey = normalizeKey(row.location_name);
      if (processedLocationNames.has(locationKey)) {
        continue;
      }
      processedLocationNames.add(locationKey);

      const result = createLocationIfMissing(row.location_name);
      locationIdByName.set(locationKey, result.location.id);

      if (result.created) {
        locationsCreated.push(result.location);
      } else {
        locationsReused.push(result.location);
      }
    }

    for (const row of preview.devices) {
      if (row.status !== 'new') {
        devicesSkippedDuplicate.push(row);
        continue;
      }

      const locationId = locationIdByName.get(normalizeKey(row.location_name));
      if (!locationId) {
        warnings.push(`Device "${row.alias}" skipped: missing location resolution.`);
        continue;
      }

      if (row.teamviewer_id && deviceExistsByTeamviewerId(row.teamviewer_id)) {
        devicesSkippedDuplicate.push({
          ...row,
          status: 'duplicate',
          status_reason: 'Detected duplicate during transaction by teamviewer_id'
        });
        continue;
      }

      if (!row.teamviewer_id && deviceExistsByFallback(locationId, row.alias)) {
        devicesSkippedDuplicate.push({
          ...row,
          status: 'duplicate',
          status_reason: 'Detected duplicate during transaction by fallback key'
        });
        continue;
      }

      const id = insertImportedDevice(row, locationId);
      devicesCreated.push({
        id,
        location_id: locationId,
        name: row.alias,
        teamviewer_id: row.teamviewer_id,
        device_role: row.role
      });
    }
  });

  importTransaction();

  console.log(
    `[TeamViewer Import] locations_created=${locationsCreated.length} locations_reused=${locationsReused.length} devices_created=${devicesCreated.length} devices_skipped_duplicate=${devicesSkippedDuplicate.length}`
  );

  return {
    imported_at: new Date().toISOString(),
    summary: {
      locations_created: locationsCreated.length,
      locations_reused: locationsReused.length,
      devices_created: devicesCreated.length,
      devices_skipped_duplicate: devicesSkippedDuplicate.length,
      warnings: warnings.length
    },
    id_strategy: preview.id_strategy,
    locations_created: locationsCreated,
    locations_reused: locationsReused,
    devices_created: devicesCreated,
    devices_skipped_duplicate: devicesSkippedDuplicate,
    warnings
  };
}

module.exports = {
  detectDeviceRole,
  buildImportPreview,
  runImport
};
