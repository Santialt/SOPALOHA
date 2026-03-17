const test = require('node:test');
const assert = require('node:assert/strict');

const { createApiHarness } = require('./helpers/apiTestHarness');

test('security regression coverage hardens internal access, admin-only operations, and validation', async (t) => {
  const harness = createApiHarness({
    prefix: 'sopaloha-security-regression-',
    authSessionSecret: 'sopaloha-security-regression-secret'
  });

  const adminUser = {
    name: 'Security Admin',
    email: 'security.admin@example.com',
    password: 'SecurityAdmin#123',
    role: 'admin'
  };
  const techUser = {
    name: 'Security Tech',
    email: 'security.tech@example.com',
    password: 'SecurityTech#123',
    role: 'tech'
  };

  await harness.start();
  harness.seedUser(adminUser);
  harness.seedUser(techUser);

  t.after(async () => {
    await harness.stop();
  });

  await t.test('CORS allows configured origins and blocks unlisted or implicit internal origins', async () => {
    const allowedOrigin = 'http://localhost:5173';
    const allowedResult = await harness.request('OPTIONS', '/auth/login', {
      headers: {
        Origin: allowedOrigin,
        'Access-Control-Request-Method': 'POST'
      }
    });
    assert.equal(allowedResult.status, 204);
    assert.equal(allowedResult.headers.get('access-control-allow-origin'), allowedOrigin);

    const deniedOrigin = await harness.request('OPTIONS', '/auth/login', {
      headers: {
        Origin: 'https://malicious.example',
        'Access-Control-Request-Method': 'POST'
      }
    });
    assert.equal(deniedOrigin.status, 403);

    const deniedPrivateOrigin = await harness.request('OPTIONS', '/auth/login', {
      headers: {
        Origin: 'http://192.168.1.10:5173',
        'Access-Control-Request-Method': 'POST'
      }
    });
    assert.equal(deniedPrivateOrigin.status, 403);

    const noOriginResult = await harness.request('POST', '/auth/login', {
      headers: {
        Origin: null
      },
      body: {
        email: adminUser.email,
        password: adminUser.password
      }
    });
    assert.equal(noOriginResult.status, 401);
    assert.equal(noOriginResult.body.message, 'Unauthorized internal API request');
  });

  await t.test('support actions remain admin-only even when internal-access checks pass', async () => {
    const techPingResult = await harness.authedRequest(techUser, 'POST', '/support-actions/ping', {
      body: {}
    });
    assert.equal(techPingResult.status, 403);

    const techOpenResult = await harness.authedRequest(
      techUser,
      'POST',
      '/support-actions/teamviewer/open',
      {
        body: {}
      }
    );
    assert.equal(techOpenResult.status, 403);

    const adminPingResult = await harness.authedRequest(adminUser, 'POST', '/support-actions/ping', {
      body: {}
    });
    assert.equal(adminPingResult.status, 400);
    assert.match(adminPingResult.body.message, /Field 'ip' is required/);

    const adminOpenResult = await harness.authedRequest(
      adminUser,
      'POST',
      '/support-actions/teamviewer/open',
      {
        body: {}
      }
    );
    assert.equal(adminOpenResult.status, 400);
    assert.match(adminOpenResult.body.message, /Field 'teamviewer_id' is required/);
  });

  await t.test('location-note delete follows admin-only policy while the disabled module still returns 410', async () => {
    const techDeleteResult = await harness.authedRequest(techUser, 'DELETE', '/location-notes/123');
    assert.equal(techDeleteResult.status, 403);

    const adminDeleteResult = await harness.authedRequest(adminUser, 'DELETE', '/location-notes/123');
    assert.equal(adminDeleteResult.status, 410);
    assert.equal(adminDeleteResult.body.message, 'Location notes module is disabled');
  });

  await t.test('strict body validation rejects unknown fields, invalid types, and empty required payloads', async () => {
    const unknownFieldResult = await harness.authedRequest(adminUser, 'POST', '/locations', {
      body: {
        name: 'Validation Location',
        unexpected: true
      }
    });
    assert.equal(unknownFieldResult.status, 400);
    assert.match(unknownFieldResult.body.message, /Field 'unexpected' is not allowed/);

    const locationResult = await harness.authedRequest(adminUser, 'POST', '/locations', {
      body: {
        name: 'Validation Device Location'
      }
    });
    assert.equal(locationResult.status, 201);

    const invalidTypeResult = await harness.authedRequest(adminUser, 'POST', '/devices', {
      body: {
        location_id: locationResult.body.id,
        name: 'Validation Device',
        type: 'server',
        ram_gb: 'sixteen'
      }
    });
    assert.equal(invalidTypeResult.status, 400);
    assert.match(invalidTypeResult.body.message, /Field 'ram_gb' must be a number/);

    const emptyBodyResult = await harness.authedRequest(adminUser, 'POST', '/incidents', {
      body: {}
    });
    assert.equal(emptyBodyResult.status, 400);
    assert.match(emptyBodyResult.body.message, /Field 'location_id' is required/);
  });
});
