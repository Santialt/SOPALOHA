const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

test("/health/ready stays read-only and does not bootstrap schema_migrations", async (t) => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "sopaloha-health-readonly-"),
  );
  const dbPath = path.join(tempDir, "health-readonly.db");

  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const script = `
    process.env.NODE_ENV = "test";
    process.env.SQLITE_DB_PATH = ${JSON.stringify(dbPath)};
    process.env.AUTH_SESSION_SECRET = "health-readonly-secret";
    process.env.INTERNAL_API_KEY = "health-readonly-key";
    process.env.CORS_ALLOWED_ORIGINS = "http://localhost:5173";
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX = "500";
    process.env.TRUST_PROXY = "";

    const app = require("./apps/api/src/app");
    const db = require("./apps/api/src/db/connection");

    const beforeTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
      .get();
    const beforeSchemaVersion = db.pragma("schema_version", { simple: true });

    const server = app.listen(0, async () => {
      const port = server.address().port;
      const response = await fetch(\`http://127.0.0.1:\${port}/health/ready\`, {
        headers: {
          "X-Internal-Api-Key": "health-readonly-key",
        },
      });
      const body = await response.json();

      const afterTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
        .get();
      const afterSchemaVersion = db.pragma("schema_version", { simple: true });

      console.log(JSON.stringify({
        status: response.status,
        body,
        beforeTable: beforeTable || null,
        afterTable: afterTable || null,
        beforeSchemaVersion,
        afterSchemaVersion,
      }));

      server.close(() => {
        db.close();
      });
    });
  `;

  const result = spawnSync(process.execPath, ["-e", script], {
    cwd: path.resolve(__dirname, "../../../.."),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(
    result.stdout.trim().split(/\r?\n/).filter(Boolean).pop(),
  );

  assert.equal(output.status, 500);
  assert.equal(output.body.status, "error");
  assert.equal(output.body.checks.migrations, "error");
  assert.equal(
    output.body.details.migrations.detail,
    "schema_migrations table is missing",
  );
  assert.equal(output.beforeTable, null);
  assert.equal(output.afterTable, null);
  assert.equal(output.beforeSchemaVersion, 0);
  assert.equal(output.afterSchemaVersion, 0);
});
