const {
  detectDeviceRole,
  normalizeKey,
  resolveTeamviewerId,
  normalizeDeviceAlias,
  normalizeDeviceGroupId,
  loadTeamviewerSnapshot,
  buildExistingLocationsMap,
  buildExistingDeviceMaps
} = require('./teamviewerImportService');

function normalizeState(rawDevice) {
  return String(rawDevice?.online_state || rawDevice?.status || rawDevice?.state || '').trim() || null;
}

function buildExplorerSnapshot() {
  return loadTeamviewerSnapshot();
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
    const devices = devicesByGroupId.get(group.group_id) || [];

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

  return {
    generated_at: new Date().toISOString(),
    summary: {
      groups_total: groups.length,
      devices_total: flatDevices.length,
      groups_linked_to_locations: groups.filter((group) => group.exists_in_sopaloha).length,
      devices_linked_to_sopaloha: flatDevices.filter((device) => device.exists_in_sopaloha).length
    },
    groups
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

module.exports = {
  buildExplorerData,
  getGroupDetail,
  getDeviceDetail
};
