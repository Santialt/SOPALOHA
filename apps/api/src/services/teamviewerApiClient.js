const { httpError } = require('../utils/httpError');
const { logger } = require('../utils/logger');

const TEAMVIEWER_BASE_URL = process.env.TEAMVIEWER_API_BASE_URL || 'https://webapi.teamviewer.com/api/v1';
const TEAMVIEWER_TIMEOUT_MS = Number(process.env.TEAMVIEWER_TIMEOUT_MS || 15000);
const TEAMVIEWER_MAX_RETRIES = Number(process.env.TEAMVIEWER_MAX_RETRIES || 1);
const TEAMVIEWER_BASE_BACKOFF_MS = 300;
const TEAMVIEWER_MAX_BACKOFF_MS = 5000;
const TEAMVIEWER_REPORTS_PAGE_LIMIT = 1000;

function getTeamviewerToken() {
  const token = String(process.env.TEAMVIEWER_API_TOKEN || '').trim();
  if (!token) {
    throw httpError(500, 'TEAMVIEWER_API_TOKEN is not configured', { code: 'TEAMVIEWER_NOT_CONFIGURED' });
  }
  return token;
}

function getTeamviewerReportsToken() {
  const token = String(process.env.TEAMVIEWER_REPORTS_API_TOKEN || process.env.TEAMVIEWER_API_TOKEN || '').trim();
  if (!token) {
    throw httpError(500, 'TEAMVIEWER_REPORTS_API_TOKEN (or TEAMVIEWER_API_TOKEN) is not configured', {
      code: 'TEAMVIEWER_REPORTS_NOT_CONFIGURED'
    });
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

function parseRetryAfterMs(response) {
  const raw = response.headers.get('retry-after');
  if (!raw) {
    return null;
  }

  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return Math.min(asNumber * 1000, TEAMVIEWER_MAX_BACKOFF_MS);
  }

  const asDate = Date.parse(raw);
  if (Number.isNaN(asDate)) {
    return null;
  }

  return Math.min(Math.max(asDate - Date.now(), 0), TEAMVIEWER_MAX_BACKOFF_MS);
}

function getRetryDelayMs(attempt, response) {
  const retryAfterMs = response ? parseRetryAfterMs(response) : null;
  if (retryAfterMs !== null) {
    return retryAfterMs;
  }

  return Math.min(TEAMVIEWER_BASE_BACKOFF_MS * 2 ** attempt, TEAMVIEWER_MAX_BACKOFF_MS);
}

function createExternalServiceError({ message, code, retryable, details, cause }) {
  return httpError(502, message, {
    code,
    source: 'teamviewer',
    retryable,
    clientMessage:
      code === 'TEAMVIEWER_AUTH_ERROR'
        ? 'TeamViewer authentication failed'
        : code === 'TEAMVIEWER_RATE_LIMITED'
          ? 'TeamViewer is temporarily rate limited'
          : code === 'TEAMVIEWER_BAD_RESPONSE'
            ? 'TeamViewer returned invalid data'
            : 'TeamViewer service is temporarily unavailable',
    details,
    cause
  });
}

async function doFetch(url, token, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      },
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw createExternalServiceError({
        message: `TeamViewer API timed out after ${timeoutMs}ms`,
        code: 'TEAMVIEWER_TIMEOUT',
        retryable: true,
        cause: error
      });
    }

    throw createExternalServiceError({
      message: 'TeamViewer API network request failed',
      code: 'TEAMVIEWER_NETWORK_ERROR',
      retryable: true,
      cause: error
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(pathname, query = {}, options = {}) {
  const tokenResolver = options.useReportsToken ? getTeamviewerReportsToken : getTeamviewerToken;
  const token = tokenResolver();
  const pathWithQuery = buildPath(pathname, query);
  const url = `${TEAMVIEWER_BASE_URL}${pathWithQuery}`;
  const timeoutMs = Number(options.timeoutMs || TEAMVIEWER_TIMEOUT_MS);
  const maxRetries = Number.isInteger(options.maxRetries) ? options.maxRetries : TEAMVIEWER_MAX_RETRIES;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await doFetch(url, token, timeoutMs);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const remoteMessage = payload?.error || payload?.message || `status ${response.status}`;
        const retryable = isRetryableStatus(response.status);
        const error = createExternalServiceError({
          message: `TeamViewer API error for ${pathWithQuery}: ${remoteMessage}`,
          code:
            response.status === 401 || response.status === 403
              ? 'TEAMVIEWER_AUTH_ERROR'
              : response.status === 429
                ? 'TEAMVIEWER_RATE_LIMITED'
                : retryable
                  ? 'TEAMVIEWER_UPSTREAM_ERROR'
                  : 'TEAMVIEWER_BAD_RESPONSE',
          retryable,
          details: {
            upstream_status: response.status
          }
        });

        if (!retryable || attempt === maxRetries) {
          throw error;
        }

        const waitMs = getRetryDelayMs(attempt, response);
        logger.warn('Retrying TeamViewer request after upstream error', {
          path: pathWithQuery,
          attempt: attempt + 1,
          wait_ms: waitMs,
          upstream_status: response.status
        });
        await sleep(waitMs);
        continue;
      }

      return payload;
    } catch (error) {
      lastError = error;
      const retryable = error?.retryable === true;
      if (!retryable || attempt === maxRetries) {
        throw error;
      }

      const waitMs = getRetryDelayMs(attempt);
      logger.warn('Retrying TeamViewer request after transient failure', {
        path: pathWithQuery,
        attempt: attempt + 1,
        wait_ms: waitMs,
        error_code: error.code || null
      });
      await sleep(waitMs);
    }
  }

  throw lastError || createExternalServiceError({
    message: 'TeamViewer request failed',
    code: 'TEAMVIEWER_REQUEST_FAILED',
    retryable: false
  });
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
      if (error?.code !== 'TEAMVIEWER_BAD_RESPONSE') {
        throw error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  return [];
}

function normalizeDateOnly(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

function parseDateOnly(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date, amount) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function splitDateRange(fromDate, toDate) {
  const fromMs = fromDate.getTime();
  const toMs = toDate.getTime();
  const totalDays = Math.floor((toMs - fromMs) / 86400000);
  const leftDays = Math.floor(totalDays / 2);
  const leftEnd = addUtcDays(fromDate, leftDays);
  const rightStart = addUtcDays(leftEnd, 1);

  return [
    {
      from_date: formatDateOnly(fromDate),
      to_date: formatDateOnly(leftEnd)
    },
    {
      from_date: formatDateOnly(rightStart),
      to_date: formatDateOnly(toDate)
    }
  ];
}

function getRecordsRemaining(payload) {
  const candidates = [
    payload?.records_remaining,
    payload?.recordsRemaining,
    payload?.pagination?.records_remaining,
    payload?.pagination?.recordsRemaining
  ];

  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return 0;
}

function dedupeConnectionRows(rows) {
  const deduped = new Map();

  for (const row of rows) {
    const key = String(row?.id || row?.connection_id || '').trim();
    if (key) {
      if (!deduped.has(key)) {
        deduped.set(key, row);
      }
      continue;
    }

    deduped.set(`row-${deduped.size}`, row);
  }

  return [...deduped.values()];
}

async function fetchConnectionReportsPage(range) {
  const payload = await fetchJson('/reports/connections', {
    from_date: range.from_date,
    to_date: range.to_date,
    limit: TEAMVIEWER_REPORTS_PAGE_LIMIT
  }, {
    useReportsToken: true,
    timeoutMs: Math.max(TEAMVIEWER_TIMEOUT_MS, 20000)
  });

  return {
    rows: extractArray(payload, ['records', 'connections', 'items', 'data']),
    recordsRemaining: getRecordsRemaining(payload)
  };
}

async function fetchConnectionReportsByDateRange(range, depth = 0) {
  const page = await fetchConnectionReportsPage(range);
  const fromDate = parseDateOnly(range.from_date);
  const toDate = parseDateOnly(range.to_date);
  const canSplit = fromDate.getTime() < toDate.getTime();
  const isLikelyCapped =
    page.rows.length >= TEAMVIEWER_REPORTS_PAGE_LIMIT || page.recordsRemaining > 0;

  if (!isLikelyCapped || !canSplit) {
    if (isLikelyCapped && !canSplit) {
      logger.warn('TeamViewer reports range appears capped at one day granularity', {
        from_date: range.from_date,
        to_date: range.to_date,
        rows: page.rows.length,
        records_remaining: page.recordsRemaining
      });
    }

    return page.rows;
  }

  const [leftRange, rightRange] = splitDateRange(fromDate, toDate);
  logger.warn('TeamViewer reports range exceeded upstream page cap, splitting request window', {
    from_date: range.from_date,
    to_date: range.to_date,
    rows: page.rows.length,
    records_remaining: page.recordsRemaining,
    depth
  });

  const [leftRows, rightRows] = await Promise.all([
    fetchConnectionReportsByDateRange(leftRange, depth + 1),
    fetchConnectionReportsByDateRange(rightRange, depth + 1)
  ]);

  return dedupeConnectionRows([...leftRows, ...rightRows]);
}

async function fetchConnectionReports(range) {
  const normalizedRange = {
    from_date: normalizeDateOnly(range?.from_date),
    to_date: normalizeDateOnly(range?.to_date)
  };

  if (!normalizedRange.from_date || !normalizedRange.to_date) {
    throw createExternalServiceError({
      message: 'TeamViewer reports require valid from_date and to_date values',
      code: 'TEAMVIEWER_BAD_RESPONSE',
      retryable: false
    });
  }

  return fetchConnectionReportsByDateRange(normalizedRange);
}

module.exports = { fetchDevices, fetchGroups, fetchConnectionReports };
