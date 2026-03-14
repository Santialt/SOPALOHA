const test = require('node:test');
const assert = require('node:assert/strict');

const { createApiHarness } = require('./helpers/apiTestHarness');

test('auth and authorization flows use session auth and role gates correctly', async (t) => {
  const harness = createApiHarness({
    prefix: 'sopaloha-api-auth-',
    authSessionSecret: 'sopaloha-auth-suite-secret'
  });

  const adminUser = {
    name: 'Admin Integration',
    email: 'admin.integration@example.com',
    password: 'Admin#Integration123',
    role: 'admin'
  };
  const techUser = {
    name: 'Tech Integration',
    email: 'tech.integration@example.com',
    password: 'Tech#Integration123',
    role: 'tech'
  };

  await harness.start();
  harness.seedUser(adminUser);
  harness.seedUser(techUser);

  t.after(async () => {
    await harness.stop();
  });

  await t.test('login succeeds with valid credentials and returns current user', async () => {
    const loginResult = await harness.login(adminUser.email, adminUser.password);

    assert.equal(loginResult.status, 200);
    assert.equal(loginResult.body.email, adminUser.email);
    assert.equal(loginResult.body.role, 'admin');
    assert.match(loginResult.sessionCookie || '', /sopaloha_session=/);

    const meResult = await harness.request('GET', '/auth/me', {
      headers: {
        Cookie: loginResult.sessionCookie
      }
    });

    assert.equal(meResult.status, 200);
    assert.equal(meResult.body.email, adminUser.email);
    assert.equal(meResult.body.name, adminUser.name);
  });

  await t.test('login fails with bad credentials', async () => {
    const result = await harness.login(adminUser.email, 'WrongPassword#1');

    assert.equal(result.status, 401);
    assert.equal(result.body.message, 'Invalid credentials');
  });

  await t.test('protected routes reject unauthenticated requests', async () => {
    const result = await harness.request('GET', '/locations');

    assert.equal(result.status, 401);
    assert.equal(result.body.message, 'Authentication required');
  });

  await t.test('admin-only routes reject non-admin users', async () => {
    const result = await harness.authedRequest(techUser, 'GET', '/users');

    assert.equal(result.status, 403);
    assert.equal(result.body.message, 'Forbidden');
  });

  await t.test('admin-only routes allow admins', async () => {
    const result = await harness.authedRequest(adminUser, 'GET', '/users');

    assert.equal(result.status, 200);
    assert.ok(Array.isArray(result.body));
    assert.ok(result.body.some((user) => user.email === adminUser.email));
    assert.ok(result.body.some((user) => user.email === techUser.email));
  });
});
