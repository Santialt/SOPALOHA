const test = require("node:test");
const assert = require("node:assert/strict");

const { createApiHarness } = require("./helpers/apiTestHarness");

test("login rate limiting returns 429 after repeated failed attempts", async (t) => {
  const harness = createApiHarness({
    prefix: "sopaloha-rate-limit-",
    authSessionSecret: "sopaloha-rate-limit-secret",
    authLoginRateLimitMax: 2,
  });

  await harness.start();

  t.after(async () => {
    await harness.stop();
  });

  const firstAttempt = await harness.request("POST", "/auth/login", {
    body: {
      email: "nobody@example.com",
      password: "WrongPassword#1",
    },
  });
  assert.equal(firstAttempt.status, 401);

  const secondAttempt = await harness.request("POST", "/auth/login", {
    body: {
      email: "nobody@example.com",
      password: "WrongPassword#1",
    },
  });
  assert.equal(secondAttempt.status, 401);

  const thirdAttempt = await harness.request("POST", "/auth/login", {
    body: {
      email: "nobody@example.com",
      password: "WrongPassword#1",
    },
  });
  assert.equal(thirdAttempt.status, 429);
  assert.equal(thirdAttempt.body.code, "RATE_LIMITED");
});
