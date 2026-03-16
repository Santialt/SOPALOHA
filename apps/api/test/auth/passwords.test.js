const test = require("node:test");
const assert = require("node:assert/strict");

const { hashPassword, verifyPassword } = require("../../src/utils/passwords");

test("hashPassword genera hashes verificables", () => {
  const password = "Sopaloha#Test123";
  const hash = hashPassword(password);

  assert.ok(hash.startsWith("scrypt$"));
  assert.equal(verifyPassword(password, hash), true);
  assert.equal(verifyPassword("incorrecta", hash), false);
});
