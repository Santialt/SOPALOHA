const test = require('node:test');
const assert = require('node:assert/strict');

test('session configuration fails closed when AUTH_SESSION_SECRET is missing', () => {
  const authSessionModulePath = require.resolve('../../src/utils/authSession');
  const originalSecret = process.env.AUTH_SESSION_SECRET;

  delete process.env.AUTH_SESSION_SECRET;
  delete require.cache[authSessionModulePath];

  try {
    const { requireSessionSecret } = require('../../src/utils/authSession');
    assert.throws(
      () => requireSessionSecret(),
      /AUTH_SESSION_SECRET must be defined/
    );
  } finally {
    if (originalSecret === undefined) {
      delete process.env.AUTH_SESSION_SECRET;
    } else {
      process.env.AUTH_SESSION_SECRET = originalSecret;
    }
    delete require.cache[authSessionModulePath];
  }
});
