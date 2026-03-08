const { httpError } = require('../utils/httpError');

const TEAMVIEWER_BASE_URL = process.env.TEAMVIEWER_API_BASE_URL || 'https://webapi.teamviewer.com/api/v1';

function getTeamviewerToken() {
  const token = String(process.env.TEAMVIEWER_API_TOKEN || '').trim();
  if (!token) {
    throw httpError(500, 'TEAMVIEWER_API_TOKEN is not configured');
  }
  return token;
}

function getTeamviewerReportsToken() {
  const token = String(process.env.TEAMVIEWER_REPORTS_API_TOKEN || process.env.TEAMVIEWER_API_TOKEN || '').trim();
  if (!token) {
    throw httpError(500, 'TEAMVIEWER_REPORTS_API_TOKEN (or TEAMVIEWER_API_TOKEN) is not configured');
  }
  return token;
}

function buildPath(pathname, query = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || String(value).trim() === '') {
      continue;
    }
    params.set(key, String(value));
  }

  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

async function fetchJson(pathname, query = {}, options = {}) {
  const tokenResolver = options.useReportsToken ? getTeamviewerReportsToken : getTeamviewerToken;
  const token = tokenResolver();
  const pathWithQuery = buildPath(pathname, query);
  const url = `${TEAMVIEWER_BASE_URL}${pathWithQuery}`;

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
    throw httpError(502, `TeamViewer API error for ${pathWithQuery}: ${message}`);
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

function getPaginationOffset(payload) {
  const candidates = [
    payload?.next_offset,
    payload?.nextOffset,
    payload?.pagination?.next_offset,
    payload?.pagination?.nextOffset,
    payload?.paging?.next_offset,
    payload?.paging?.nextOffset
  ];

  for (const value of candidates) {
    if (value === undefined || value === null || String(value).trim() === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }

  return null;
}

async function fetchConnectionReportsByQueryStrategy(range, queryMapping) {
  const pageSize = 1000;
  const maxPages = 100;
  const rows = [];
  let offset = 0;
  const seenPageSignatures = new Set();

  for (let page = 0; page < maxPages; page += 1) {
    const query = {
      [queryMapping.fromKey]: range.from_date,
      [queryMapping.toKey]: range.to_date,
      offset,
      limit: pageSize
    };

    const payload = await fetchJson('/reports/connections', query, { useReportsToken: true });
    const pageRows = extractArray(payload, ['records', 'connections', 'items', 'data']);

    const firstId = String(pageRows[0]?.id || pageRows[0]?.connection_id || '').trim();
    const lastId = String(pageRows[pageRows.length - 1]?.id || pageRows[pageRows.length - 1]?.connection_id || '').trim();
    const signature = `${firstId}::${lastId}::${pageRows.length}`;
    if (pageRows.length > 0 && seenPageSignatures.has(signature)) {
      break;
    }
    seenPageSignatures.add(signature);

    rows.push(...pageRows);

    if (pageRows.length === 0) {
      break;
    }

    const nextOffset = getPaginationOffset(payload);
    if (nextOffset === null) {
      if (pageRows.length < pageSize) break;
      offset += pageSize;
      continue;
    }

    if (nextOffset <= offset) {
      break;
    }
    offset = nextOffset;
  }

  return rows;
}

async function fetchConnectionReports(range) {
  const strategies = [
    { fromKey: 'from_date', toKey: 'to_date' },
    { fromKey: 'start_date', toKey: 'end_date' },
    { fromKey: 'from', toKey: 'to' }
  ];

  let lastError = null;
  for (const strategy of strategies) {
    try {
      return await fetchConnectionReportsByQueryStrategy(range, strategy);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return [];
}

module.exports = { fetchDevices, fetchGroups, fetchConnectionReports };
