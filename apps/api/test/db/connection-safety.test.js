const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { spawnSync } = require("child_process");

test("rechaza data/support.db cuando NODE_ENV=test", () => {
  const repoRoot = path.resolve(__dirname, "../../../..");
  const connectionModulePath = path.join(
    repoRoot,
    "apps/api/src/db/connection.js",
  );
  const protectedDbPath = path.join(repoRoot, "data/support.db");

  const result = spawnSync(
    process.execPath,
    ["-e", `require(${JSON.stringify(connectionModulePath)})`],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        NODE_ENV: "test",
        SQLITE_DB_PATH: protectedDbPath,
      },
      encoding: "utf8",
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Refusing to open production SQLite path during tests/,
  );
});

test("resuelve data/support.db relativo a la raiz del repo", () => {
  const repoRoot = path.resolve(__dirname, "../../../..");
  const connectionModulePath = path.join(
    repoRoot,
    "apps/api/src/db/connection.js",
  );
  const expectedDbPath = path.join(repoRoot, "data/support.db");

  const result = spawnSync(
    process.execPath,
    [
      "-e",
      `const connection = require(${JSON.stringify(connectionModulePath)}); console.log(connection.resolveConfiguredDbPath("data/support.db"));`,
    ],
    {
      cwd: path.join(repoRoot, "apps/api"),
      env: {
        ...process.env,
        NODE_ENV: "development",
      },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), path.resolve(expectedDbPath));
});

test("mantiene compatibilidad con ../../data/support.db desde apps/api", () => {
  const repoRoot = path.resolve(__dirname, "../../../..");
  const connectionModulePath = path.join(
    repoRoot,
    "apps/api/src/db/connection.js",
  );
  const expectedDbPath = path.join(repoRoot, "data/support.db");

  const result = spawnSync(
    process.execPath,
    [
      "-e",
      `const connection = require(${JSON.stringify(connectionModulePath)}); console.log(connection.resolveConfiguredDbPath("../../data/support.db"));`,
    ],
    {
      cwd: path.join(repoRoot, "apps/api"),
      env: {
        ...process.env,
        NODE_ENV: "development",
      },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), path.resolve(expectedDbPath));
});
