const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const Database = require("better-sqlite3");
const { restoreDatabase } = require("../../scripts/restore-db");

function runNode(args, options = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: path.resolve(__dirname, "../../../.."),
    encoding: "utf8",
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(
      `Command failed (${args.join(" ")}): ${result.stderr || result.stdout}`,
    );
  }

  return result;
}

test("backup and restore scripts produce a restorable SQLite database with migrations intact", async (t) => {
  const repoRoot = path.resolve(__dirname, "../../../..");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sopaloha-restore-"));
  const sourceDbPath = path.join(tempDir, "source.db");
  const restoredDbPath = path.join(tempDir, "restored.db");
  const backupFilePath = path.join(tempDir, "backup.db");

  let restoredDb = null;

  t.after(() => {
    if (restoredDb) {
      restoredDb.close();
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  runNode(
    [
      "-e",
      `
        process.env.NODE_ENV = "test";
        process.env.SQLITE_DB_PATH = ${JSON.stringify(sourceDbPath)};
        process.env.AUTH_SESSION_SECRET = "restore-suite-secret";
        const db = require("./apps/api/src/db/connection");
        const { initDatabase } = require("./apps/api/src/db/initDb");
        const { hashPassword } = require("./apps/api/src/utils/passwords");
        initDatabase();
        db.prepare("INSERT INTO locations (name, status, country) VALUES (?, 'active', ?)").run("Restore Local", "AR");
        db.prepare("INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, 'admin', 1)")
          .run("Restore Admin", "restore.admin@example.com", hashPassword("Restore#123"));
        db.close();
      `,
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        NODE_ENV: "test",
      },
    },
  );

  runNode(["apps/api/scripts/backup-db.js", backupFilePath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: "production",
      SQLITE_DB_PATH: sourceDbPath,
    },
  });

  const placeholderDb = new Database(restoredDbPath);
  placeholderDb.exec(
    "CREATE TABLE placeholder (id INTEGER PRIMARY KEY, note TEXT);",
  );
  placeholderDb.close();

  runNode(["apps/api/scripts/restore-db.js", backupFilePath, restoredDbPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: "production",
    },
  });

  restoredDb = new Database(restoredDbPath, { readonly: true });

  const integrity = restoredDb.pragma("integrity_check", { simple: true });
  assert.equal(String(integrity).toLowerCase(), "ok");

  const restoredLocation = restoredDb
    .prepare("SELECT name, country FROM locations WHERE name = ?")
    .get("Restore Local");
  assert.deepEqual(restoredLocation, {
    name: "Restore Local",
    country: "AR",
  });

  const restoredUser = restoredDb
    .prepare("SELECT email, role FROM users WHERE email = ?")
    .get("restore.admin@example.com");
  assert.deepEqual(restoredUser, {
    email: "restore.admin@example.com",
    role: "admin",
  });

  const appliedMigrations = restoredDb
    .prepare("SELECT id FROM schema_migrations ORDER BY id ASC")
    .all()
    .map((row) => row.id);
  assert.deepEqual(appliedMigrations, [
    "001_init",
    "002_release_hardening",
    "003_schema_convergence",
  ]);

  const preRestoreBackups = fs
    .readdirSync(tempDir)
    .filter((entry) => entry.startsWith("restored.db.pre-restore-"));
  assert.equal(preRestoreBackups.length, 1);
});

test("restoreDatabase rolls back automatically when post-restore validation fails", async (t) => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "sopaloha-restore-rollback-"),
  );
  const sourceDbPath = path.join(tempDir, "source.db");
  const targetDbPath = path.join(tempDir, "target.db");
  const backupFilePath = path.join(tempDir, "backup.db");

  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const sourceDb = new Database(sourceDbPath);
  sourceDb.exec(`
    CREATE TABLE marker (value TEXT NOT NULL);
    INSERT INTO marker (value) VALUES ('backup-value');
  `);
  sourceDb.close();

  fs.copyFileSync(sourceDbPath, backupFilePath);

  const targetDb = new Database(targetDbPath);
  targetDb.exec(`
    CREATE TABLE marker (value TEXT NOT NULL);
    INSERT INTO marker (value) VALUES ('pre-restore-value');
  `);
  targetDb.close();

  assert.throws(
    () =>
      restoreDatabase({
        sourcePath: backupFilePath,
        targetPath: targetDbPath,
        validate() {
          throw new Error("simulated post-restore validation failure");
        },
      }),
    /Previous database restored automatically/,
  );

  const rolledBackDb = new Database(targetDbPath, { readonly: true });
  const marker = rolledBackDb.prepare("SELECT value FROM marker").get();
  rolledBackDb.close();

  assert.deepEqual(marker, { value: "pre-restore-value" });

  const preRestoreBackups = fs
    .readdirSync(tempDir)
    .filter((entry) => entry.startsWith("target.db.pre-restore-"));
  assert.equal(preRestoreBackups.length, 1);
});
