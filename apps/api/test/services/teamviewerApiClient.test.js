const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modulePath = path.resolve(__dirname, '../../src/services/teamviewerApiClient.js');
const originalEnv = {
  TEAMVIEWER_API_TOKEN: process.env.TEAMVIEWER_API_TOKEN,
  TEAMVIEWER_REPORTS_API_TOKEN: process.env.TEAMVIEWER_REPORTS_API_TOKEN,
  TEAMVIEWER_TIMEOUT_MS: process.env.TEAMVIEWER_TIMEOUT_MS,
  TEAMVIEWER_MAX_RETRIES: process.env.TEAMVIEWER_MAX_RETRIES
};
const realFetch = global.fetch;

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function loadClient(envOverrides = {}) {
  process.env.TEAMVIEWER_API_TOKEN = envOverrides.TEAMVIEWER_API_TOKEN || 'teamviewer-token';
  process.env.TEAMVIEWER_REPORTS_API_TOKEN =
    envOverrides.TEAMVIEWER_REPORTS_API_TOKEN || envOverrides.TEAMVIEWER_API_TOKEN || 'teamviewer-reports-token';
  process.env.TEAMVIEWER_TIMEOUT_MS = String(envOverrides.TEAMVIEWER_TIMEOUT_MS || 25);
  process.env.TEAMVIEWER_MAX_RETRIES = String(envOverrides.TEAMVIEWER_MAX_RETRIES || 0);
  delete require.cache[modulePath];
  return require(modulePath);
}

function jsonResponse(payload, options = {}) {
  return new Response(JSON.stringify(payload), {
    status: options.status || 200,
    headers: options.headers || {}
  });
}

function textResponse(body, options = {}) {
  return new Response(body, {
    status: options.status || 200,
    headers: options.headers || {}
  });
}

test.afterEach(() => {
  global.fetch = realFetch;
  restoreEnv();
  delete require.cache[modulePath];
});

test('fetchDevices surfaces TeamViewer timeouts as retryable upstream errors', async () => {
  const client = loadClient({
    TEAMVIEWER_TIMEOUT_MS: 10,
    TEAMVIEWER_MAX_RETRIES: 0
  });

  let callCount = 0;
  global.fetch = (_url, options = {}) =>
    new Promise((_resolve, reject) => {
      callCount += 1;
      options.signal?.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });

  await assert.rejects(client.fetchDevices(), (error) => {
    assert.equal(callCount, 1);
    assert.equal(error.status, 502);
    assert.equal(error.code, 'TEAMVIEWER_TIMEOUT');
    assert.equal(error.retryable, true);
    assert.equal(error.clientMessage, 'TeamViewer service is temporarily unavailable');
    return true;
  });
});

test('fetchDevices maps 401 and 403 to TeamViewer auth errors without retrying', async () => {
  for (const status of [401, 403]) {
    const client = loadClient({
      TEAMVIEWER_MAX_RETRIES: 1
    });

    let callCount = 0;
    global.fetch = async () => {
      callCount += 1;
      return jsonResponse({ error: 'forbidden' }, { status });
    };

    await assert.rejects(client.fetchDevices(), (error) => {
      assert.equal(callCount, 1);
      assert.equal(error.status, 502);
      assert.equal(error.code, 'TEAMVIEWER_AUTH_ERROR');
      assert.equal(error.retryable, false);
      assert.equal(error.clientMessage, 'TeamViewer authentication failed');
      return true;
    });
  }
});

test('fetchDevices retries rate-limited responses once and honors retry-after when present', async () => {
  const client = loadClient({
    TEAMVIEWER_MAX_RETRIES: 1
  });

  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    if (calls.length === 1) {
      return jsonResponse(
        { message: 'slow down' },
        {
          status: 429,
          headers: { 'retry-after': '0' }
        }
      );
    }

    return jsonResponse({ devices: [{ id: 'device-1' }] });
  };

  const devices = await client.fetchDevices();

  assert.equal(calls.length, 2);
  assert.deepEqual(devices, [{ id: 'device-1' }]);
});

test('fetchDevices retries a single 5xx response and stops after the configured max retries', async () => {
  const client = loadClient({
    TEAMVIEWER_MAX_RETRIES: 1
  });

  let callCount = 0;
  global.fetch = async () => {
    callCount += 1;
    if (callCount === 1) {
      return jsonResponse({ error: 'gateway failed' }, { status: 502 });
    }

    return jsonResponse({ devices: [{ id: 'device-2' }] });
  };

  const devices = await client.fetchDevices();

  assert.equal(callCount, 2);
  assert.deepEqual(devices, [{ id: 'device-2' }]);

  const failingClient = loadClient({
    TEAMVIEWER_MAX_RETRIES: 1
  });

  callCount = 0;
  global.fetch = async () => {
    callCount += 1;
    return jsonResponse({ error: 'upstream down' }, { status: 503 });
  };

  await assert.rejects(failingClient.fetchDevices(), (error) => {
    assert.equal(callCount, 2);
    assert.equal(error.code, 'TEAMVIEWER_UPSTREAM_ERROR');
    assert.equal(error.clientMessage, 'TeamViewer service is temporarily unavailable');
    return true;
  });
});

test('fetchDevices retries transient network failures when retries are enabled', async () => {
  const client = loadClient({
    TEAMVIEWER_MAX_RETRIES: 1
  });

  let callCount = 0;
  global.fetch = async () => {
    callCount += 1;
    if (callCount === 1) {
      throw new Error('socket hang up');
    }

    return jsonResponse({ devices: [{ id: 'device-3' }] });
  };

  const devices = await client.fetchDevices();
  assert.equal(callCount, 2);
  assert.deepEqual(devices, [{ id: 'device-3' }]);
});

test('fetchGroups falls back to the alternate endpoint only for bad responses and malformed payloads', async () => {
  const client = loadClient({
    TEAMVIEWER_MAX_RETRIES: 0
  });

  const calls = [];
  global.fetch = async (url) => {
    calls.push(new URL(String(url)).pathname);
    if (calls.length === 1) {
      return jsonResponse({ not_groups: [] });
    }

    return jsonResponse({ groups: [{ id: 'group-1', name: 'Local Centro' }] });
  };

  const groups = await client.fetchGroups();
  assert.deepEqual(groups, [{ id: 'group-1', name: 'Local Centro' }]);
  assert.deepEqual(calls, ['/api/v1/device-groups', '/api/v1/groups']);

  const authErrorClient = loadClient({
    TEAMVIEWER_MAX_RETRIES: 0
  });

  let authCalls = 0;
  global.fetch = async () => {
    authCalls += 1;
    return jsonResponse({ error: 'unauthorized' }, { status: 401 });
  };

  await assert.rejects(authErrorClient.fetchGroups(), (error) => {
    assert.equal(authCalls, 1);
    assert.equal(error.code, 'TEAMVIEWER_AUTH_ERROR');
    return true;
  });
});

test('fetchDevices tolerates malformed upstream JSON by returning an empty device list', async () => {
  const client = loadClient();
  global.fetch = async () => textResponse('not-json', { status: 200 });

  const devices = await client.fetchDevices();
  assert.deepEqual(devices, []);
});

test('fetchConnectionReports paginates through report pages and stops on repeated page signatures', async () => {
  const client = loadClient({
    TEAMVIEWER_MAX_RETRIES: 0
  });

  const offsets = [];
  global.fetch = async (url) => {
    const parsedUrl = new URL(String(url));
    const offset = Number(parsedUrl.searchParams.get('offset'));
    offsets.push(offset);

    if (offset === 0) {
      return jsonResponse({
        records: [
          { id: 'c1', start_time: '2026-03-10T10:00:00Z' },
          { id: 'c2', start_time: '2026-03-10T11:00:00Z' }
        ],
        pagination: { next_offset: 2 }
      });
    }

    if (offset === 2) {
      return jsonResponse({
        records: [
          { id: 'c3', start_time: '2026-03-10T12:00:00Z' }
        ],
        pagination: { next_offset: 3 }
      });
    }

    return jsonResponse({
      records: [
        { id: 'c3', start_time: '2026-03-10T12:00:00Z' }
      ],
      pagination: { next_offset: 4 }
    });
  };

  const rows = await client.fetchConnectionReports({
    from_date: '2026-03-01T00:00:00.000Z',
    to_date: '2026-03-31T23:59:59.999Z'
  });

  assert.deepEqual(
    rows.map((row) => row.id),
    ['c1', 'c2', 'c3']
  );
  assert.deepEqual(offsets, [0, 2, 3]);
});

test('fetchConnectionReports does not retry alternate query strategies for upstream auth failures', async () => {
  const client = loadClient({
    TEAMVIEWER_MAX_RETRIES: 0
  });

  let callCount = 0;
  global.fetch = async () => {
    callCount += 1;
    return jsonResponse({ error: 'invalid token' }, { status: 401 });
  };

  await assert.rejects(
    client.fetchConnectionReports({
      from_date: '2026-03-01T00:00:00.000Z',
      to_date: '2026-03-31T23:59:59.999Z'
    }),
    (error) => {
      assert.equal(callCount, 1);
      assert.equal(error.code, 'TEAMVIEWER_AUTH_ERROR');
      return true;
    }
  );
});
