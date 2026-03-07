const { httpError } = require('../utils/httpError');

const TEAMVIEWER_BASE_URL = process.env.TEAMVIEWER_API_BASE_URL || 'https://webapi.teamviewer.com/api/v1';

function getTeamviewerToken() {
  const token = String(process.env.TEAMVIEWER_API_TOKEN || '').trim();
  if (!token) {
    throw httpError(500, 'TEAMVIEWER_API_TOKEN is not configured');
  }
  return token;
}

async function fetchJson(pathname) {
  const token = getTeamviewerToken();
  const url = `${TEAMVIEWER_BASE_URL}${pathname}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });
  } catch (error) {
    throw httpError(502, `TeamViewer API request failed for ${pathname}`);
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.error || payload?.message || `status ${response.status}`;
    throw httpError(502, `TeamViewer API error for ${pathname}: ${message}`);
  }

  return payload;
}

function extractArray(payload, candidateKeys) {
  if (Array.isArray(payload)) {
    return payload;
  }

  for (const key of candidateKeys) {
    if (Array.isArray(payload?.[key])) {
      return payload[key];
    }
  }

  return [];
}

async function fetchDevices() {
  const payload = await fetchJson('/devices');
  return extractArray(payload, ['devices', 'records', 'items']);
}

async function fetchGroups() {
  const groupPaths = ['/device-groups', '/groups'];
  let lastError = null;

  for (const path of groupPaths) {
    try {
      const payload = await fetchJson(path);
      const groups = extractArray(payload, ['groups', 'device_groups', 'records', 'items']);
      if (groups.length > 0 || Array.isArray(payload?.groups)) {
        return groups;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return [];
}

module.exports = { fetchDevices, fetchGroups };
