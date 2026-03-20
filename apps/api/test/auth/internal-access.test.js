const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const path = require("path");

const {
  parseTrustProxySetting,
  requireInternalAccess,
} = require("../../src/middleware/security");

function createResponseDouble() {
  return {
    headers: new Map(),
    setHeader(name, value) {
      this.headers.set(name.toLowerCase(), value);
    },
  };
}

test("parseTrustProxySetting rejects ambiguous or permissive values", async () => {
  assert.throws(
    () => parseTrustProxySetting("true"),
    /TRUST_PROXY=true is not allowed/,
  );
  assert.throws(
    () => parseTrustProxySetting("loopback"),
    /too permissive/,
  );
  assert.equal(parseTrustProxySetting("1").expressValue, 1);
  assert.equal(parseTrustProxySetting("203.0.113.10/32").mode, "explicit-list");
});

test("requireInternalAccess does not trust spoofed private forwarded IPs over a public direct connection", async () => {
  const privateSpoofs = [
    "10.0.0.15",
    "172.16.4.20",
    "192.168.1.10",
    "127.0.0.1",
    "::1",
  ];

  process.env.INTERNAL_API_KEY = "";
  process.env.TRUST_PROXY = "1";

  for (const spoofedIp of privateSpoofs) {
    let forwardedError = null;
    const req = {
      requestId: "test-request",
      ip: spoofedIp,
      headers: {
        "x-forwarded-for": spoofedIp,
      },
      socket: {
        remoteAddress: "198.51.100.42",
      },
      connection: {
        remoteAddress: "198.51.100.42",
      },
    };

    requireInternalAccess(req, createResponseDouble(), (error) => {
      forwardedError = error || null;
    });

    assert.equal(forwardedError?.status, 401, `spoofed ${spoofedIp} must be rejected`);
    assert.match(
      forwardedError?.message || "",
      /Internal network access or valid API key required/,
    );
  }
});

test("invalid TRUST_PROXY blocks startup instead of falling back to permissive Express defaults", async () => {
  const repoRoot = path.resolve(__dirname, "../../../..");
  const sqliteDbPath = path.join(repoRoot, "apps", "api", "test-invalid-trust-proxy.db");
  const result = spawnSync(
    process.execPath,
    ["-e", `process.env.NODE_ENV="test"; process.env.AUTH_SESSION_SECRET="secret"; process.env.SQLITE_DB_PATH=${JSON.stringify(sqliteDbPath)}; process.env.TRUST_PROXY="true"; require("./apps/api/src/app");`],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr || result.stdout, /TRUST_PROXY=true is not allowed/);
});
