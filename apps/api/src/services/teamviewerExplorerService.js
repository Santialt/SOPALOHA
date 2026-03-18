const {
  detectDeviceRole,
  normalizeKey,
  normalizeString,
  resolveTeamviewerId,
  normalizeDeviceAlias,
  normalizeDeviceGroupId,
  loadTeamviewerSnapshot,
  buildExistingLocationsMap,
  buildExistingDeviceMaps
} = require('./teamviewerImportService');
const { fetchDevices } = require('./teamviewerApiClient');
const db = require('../db/connection');

const REMOTE_DEVICE_STATUS_CACHE_TTL_MS = 15000;

let remoteDeviceStatusCache = null;
let remoteDeviceStatusPromise = null;

function normalizeState(rawDevice) {
  return String(rawDevice?.online_state || rawDevice?.status || rawDevice?.state || '').trim() || null;
}

function normalizePresence(rawState) {
  const normalized = String(rawState || '').trim().toLowerCase();
  if (normalized === 'online') return 'online';
  if (normalized === 'offline') return 'offline';
  return 'unknown';
}

function buildRemoteDeviceStatusMap(rawDevices) {
  const statusesById = new Map();

  for (const rawDevice of rawDevices) {
    const resolvedId = resolveTeamviewerId(rawDevice);
    if (!resolvedId.value) continue;

    const rawState = normalizeState(rawDevice);
    const nextStatus = {
      teamviewer_id: normalizeString(resolvedId.value),
      raw_state: rawState,
      presence: normalizePresence(rawState)
    };
    const currentStatus = statusesById.get(nextStatus.teamviewer_id);

    if (!currentStatus || (!currentStatus.raw_state && nextStatus.raw_state)) {
      statusesById.set(nextStatus.teamviewer_id, nextStatus);
    }
  }

  return statusesById;
}

async function loadRemoteDeviceStatuses() {
  const now = Date.now();
  if (remoteDeviceStatusCache && remoteDeviceStatusCache.expires_at > now) {
    return remoteDeviceStatusCache;
  }

  if (!remoteDeviceStatusPromise) {
    remoteDeviceStatusPromise = (async () => {
      const rawDevices = await fetchDevices();
      const nextCache = {
        generated_at: new Date().toISOString(),
        expires_at: Date.now() + REMOTE_DEVICE_STATUS_CACHE_TTL_MS,
        stale: false,
        statuses_by_id: buildRemoteDeviceStatusMap(rawDevices)
      };
      remoteDeviceStatusCache = nextCache;
      return nextCache;
    })().finally(() => {
      remoteDeviceStatusPromise = null;
    });
  }

  try {
    return await remoteDeviceStatusPromise;
  } catch (error) {
    if (remoteDeviceStatusCache) {
      return {
        ...remoteDeviceStatusCache,
        stale: true
      };
    }
    throw error;
  }
}

function buildExplorerSnapshot() {
  return loadTeamviewerSnapshot();
}

function getSortableGroupName(group) {
  return String(group?.name ?? group?.group_name ?? '').trim();
}

function stableSortByText(items, getText) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const textA = String(getText(a.item) || '');
      const textB = String(getText(b.item) || '');
      const byText = textA.localeCompare(textB, 'es', { sensitivity: 'base' });
      if (byText !== 0) return byText;
      return a.index - b.index;
    })
    .map((entry) => entry.item);
}

async function buildExplorerData() {
  const snapshot = await buildExplorerSnapshot();
  const locationsByName = buildExistingLocationsMap();
  const { byTeamviewerId, byFallbackKey } = buildExistingDeviceMaps();

  const devicesByGroupId = new Map();
  const flatDevices = [];

  for (const rawDevice of snapshot.rawDevices) {
    const groupId = normalizeDeviceGroupId(rawDevice);
    const group = snapshot.groupsById.get(groupId);
    if (!group) continue;

    const alias = normalizeDeviceAlias(rawDevice);
    const teamviewer = resolveTeamviewerId(rawDevice);
    const location = locationsByName.get(normalizeKey(group.group_name)) || null;
    const fallbackKey = `${normalizeKey(group.group_name)}::${normalizeKey(alias)}`;
    const linkedDevice =
      (teamviewer.value && byTeamviewerId.get(teamviewer.value)) || byFallbackKey.get(fallbackKey) || null;

    const existsInSopaloha = Boolean(linkedDevice);
    const linkedLocation = linkedDevice ? locationsByName.get(normalizeKey(linkedDevice.location_name)) || null : null;

    const enrichedDevice = {
      kind: 'device',
      group_id: group.group_id,
      group_name: group.group_name,
      alias,
      teamviewer_id: teamviewer.value,
      teamviewer_id_source: teamviewer.source,
      teamviewer_device_id: String(rawDevice.device_id ?? rawDevice.deviceId ?? rawDevice.id ?? '').trim() || null,
      status: normalizeState(rawDevice),
      role_detected: detectDeviceRole(alias),
      source_status: existsInSopaloha ? 'linked' : location ? 'pending_import' : 'teamviewer_only',
      exists_in_sopaloha: existsInSopaloha,
      location_id: linkedDevice?.location_id || location?.id || null,
      location_name: linkedLocation?.name || location?.name || null,
      linked_location: linkedLocation || location || null,
      linked_device: linkedDevice || null
    };

    if (!devicesByGroupId.has(group.group_id)) {
      devicesByGroupId.set(group.group_id, []);
    }
    devicesByGroupId.get(group.group_id).push(enrichedDevice);
    flatDevices.push(enrichedDevice);
  }

  const groups = snapshot.groups.map((group) => {
    const linkedLocation = locationsByName.get(normalizeKey(group.group_name)) || null;
    const devices = stableSortByText(devicesByGroupId.get(group.group_id) || [], (device) => device.alias);

    return {
      kind: 'group',
      group_id: group.group_id,
      group_name: group.group_name,
      device_count: devices.length,
      source_status: linkedLocation ? 'linked' : 'teamviewer_only',
      exists_in_sopaloha: Boolean(linkedLocation),
      location_id: linkedLocation?.id || null,
      location_name: linkedLocation?.name || null,
      linked_location: linkedLocation,
      devices
    };
  });

  const sortedGroups = stableSortByText(groups, (group) => getSortableGroupName(group));

  return {
    generated_at: new Date().toISOString(),
    summary: {
      groups_total: groups.length,
      devices_total: flatDevices.length,
      groups_linked_to_locations: groups.filter((group) => group.exists_in_sopaloha).length,
      devices_linked_to_sopaloha: flatDevices.filter((device) => device.exists_in_sopaloha).length
    },
    groups: sortedGroups
  };
}

async function getGroupDetail(groupId) {
  const explorer = await buildExplorerData();
  const group = explorer.groups.find((item) => item.group_id === String(groupId).trim());

  return {
    generated_at: explorer.generated_at,
    group: group || null
  };
}

async function getDeviceDetail(teamviewerId) {
  const requested = String(teamviewerId || '').trim();
  const explorer = await buildExplorerData();

  let found = null;
  for (const group of explorer.groups) {
    const match = group.devices.find((device) => {
      const operationalId = String(device.teamviewer_id || '').trim();
      const fallbackId = String(device.teamviewer_device_id || '').trim();
      return operationalId === requested || fallbackId === requested;
    });

    if (match) {
      found = match;
      break;
    }
  }

  return {
    generated_at: explorer.generated_at,
    device: found
  };
}

async function getLocationDeviceStatuses(locationId) {
  const devices = db
    .prepare(
      `SELECT id, location_id, name, teamviewer_id
       FROM devices
       WHERE location_id = ?
       ORDER BY id DESC`
    )
    .all(locationId);

  const remoteStatuses = await loadRemoteDeviceStatuses();

  return {
    generated_at: remoteStatuses.generated_at,
    stale: remoteStatuses.stale,
    location_id: locationId,
    devices: devices.map((device) => {
      const normalizedTeamviewerId = normalizeString(device.teamviewer_id);
      const remoteStatus = normalizedTeamviewerId
        ? remoteStatuses.statuses_by_id.get(normalizedTeamviewerId) || null
        : null;

      return {
        device_id: device.id,
        location_id: device.location_id,
        device_name: device.name,
        teamviewer_id: device.teamviewer_id || null,
        presence: remoteStatus?.presence || 'unknown',
        raw_state: remoteStatus?.raw_state || null,
        status_available: Boolean(remoteStatus),
        status_source: remoteStatus ? 'teamviewer_remote' : 'unavailable'
      };
    })
  };
}

module.exports = {
  buildExplorerData,
  getGroupDetail,
  getDeviceDetail,
  getLocationDeviceStatuses
};
