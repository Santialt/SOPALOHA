const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const Database = require("better-sqlite3");

function runNodeInline(script, env, cwd) {
  const result = spawnSync(process.execPath, ["-e", script], {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
}

function normalizeSql(sql) {
  return String(sql || "")
    .replace(/\s+/g, " ")
    .replace(/`/g, '"')
    .trim()
    .toLowerCase();
}

function collectSchema(db, names) {
  const schema = {};

  for (const name of names) {
    schema[name] = {
      tableSql: normalizeSql(
        db
          .prepare(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
          )
          .get(name)?.sql,
      ),
      indexes: db
        .prepare(
          `
          SELECT name, sql
          FROM sqlite_master
          WHERE type = 'index'
            AND tbl_name = ?
            AND name NOT LIKE 'sqlite_autoindex_%'
          ORDER BY name ASC
        `,
        )
        .all(name)
        .map((row) => ({
          name: row.name,
          sql: normalizeSql(row.sql),
        })),
      foreignKeys: db
        .prepare(`PRAGMA foreign_key_list(${JSON.stringify(name)})`)
        .all()
        .map((row) => ({
          table: row.table,
          from: row.from,
          to: row.to,
          on_update: row.on_update,
          on_delete: row.on_delete,
          match: row.match,
        })),
      triggers: db
        .prepare(
          `
          SELECT name, sql
          FROM sqlite_master
          WHERE type = 'trigger'
            AND tbl_name = ?
          ORDER BY name ASC
        `,
        )
        .all(name)
        .map((row) => ({
          name: row.name,
          sql: normalizeSql(row.sql),
        })),
    };
  }

  return schema;
}

test("SQLite legacy upgrade converges to the same critical schema as a fresh install", async (t) => {
  const repoRoot = path.resolve(__dirname, "../../../..");
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "sopaloha-api-db-init-"),
  );
  const legacyDbPath = path.join(tempDir, "legacy-support.db");
  const freshDbPath = path.join(tempDir, "fresh-support.db");

  const legacyDb = new Database(legacyDbPath);
  legacyDb.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE locations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      company_name TEXT,
      address TEXT,
      city TEXT,
      province TEXT,
      phone TEXT,
      main_contact TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'tech',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE devices (
      id INTEGER PRIMARY KEY,
      location_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      ip_address TEXT,
      teamviewer_id TEXT,
      password TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE incidents (
      id INTEGER PRIMARY KEY,
      location_id INTEGER NOT NULL,
      device_id INTEGER,
      incident_date TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      location_id INTEGER,
      incident_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT NOT NULL DEFAULT 'medium',
      due_date TEXT,
      scheduled_for TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE location_notes (
      id INTEGER PRIMARY KEY,
      location_id INTEGER NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE on_call_shifts (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      assigned_to TEXT NOT NULL,
      backup_assigned_to TEXT,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO locations (name, status) VALUES ('Legacy Local', 'active');
    INSERT INTO users (name, email, password_hash, role, active)
      VALUES ('Legacy Admin', 'legacy.admin@example.com', 'hash', 'admin', 1);
    INSERT INTO devices (location_id, name, type, password) VALUES (1, 'Legacy Device', 'legacy_type', 'plaintext-secret');
    INSERT INTO incidents (location_id, incident_date, title, description, category, status)
      VALUES (1, '2026-03-01', 'Legacy Incident', 'Description', 'legacy_category', 'legacy_status');
    INSERT INTO tasks (title, location_id, incident_id, status, priority, due_date, scheduled_for)
      VALUES ('Legacy Task', 1, NULL, 'legacy_status', 'legacy_priority', '2026-03-10', '2026-03-10T09:00');
    INSERT INTO location_notes (location_id, note) VALUES (1, 'Legacy note');
  `);
  legacyDb.close();

  const initScript = `
    process.env.NODE_ENV = "test";
    process.env.AUTH_SESSION_SECRET = "sopaloha-db-init-secret";
    const { initDatabase } = require("./apps/api/src/db/initDb");
    const db = require("./apps/api/src/db/connection");
    initDatabase();
    db.close();
  `;

  runNodeInline(
    initScript,
    {
      SQLITE_DB_PATH: legacyDbPath,
    },
    repoRoot,
  );

  runNodeInline(
    initScript,
    {
      SQLITE_DB_PATH: freshDbPath,
    },
    repoRoot,
  );

  const upgradedDb = new Database(legacyDbPath, { readonly: true });
  const freshDb = new Database(freshDbPath, { readonly: true });

  t.after(() => {
    upgradedDb.close();
    freshDb.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const criticalTables = [
    "locations",
    "users",
    "devices",
    "location_integrations",
    "device_aliases",
    "incidents",
    "teamviewer_connections",
    "weekly_tasks",
    "tasks",
    "comments",
    "location_notes",
    "teamviewer_imported_cases",
    "on_call_shifts",
  ];

  assert.deepEqual(
    collectSchema(upgradedDb, criticalTables),
    collectSchema(freshDb, criticalTables),
  );

  const upgradedMigrationRows = upgradedDb
    .prepare("SELECT id FROM schema_migrations ORDER BY id ASC")
    .all()
    .map((row) => row.id);
  assert.deepEqual(upgradedMigrationRows, [
    "001_init",
    "002_release_hardening",
    "003_schema_convergence",
    "004_user_login_enablement",
  ]);

  const deviceColumns = upgradedDb.prepare("PRAGMA table_info(devices)").all();
  const upgradedDevice = upgradedDb
    .prepare("SELECT type, device_role FROM devices WHERE id = 1")
    .get();
  assert.equal(upgradedDevice.type, "other");
  assert.equal(upgradedDevice.device_role, "other");
  assert.equal(
    deviceColumns.some((column) => column.name === "password"),
    false,
  );

  const upgradedIncident = upgradedDb
    .prepare(
      "SELECT category, status, time_spent_minutes FROM incidents WHERE id = 1",
    )
    .get();
  assert.deepEqual(upgradedIncident, {
    category: "other",
    status: "open",
    time_spent_minutes: 0,
  });

  const upgradedTask = upgradedDb
    .prepare("SELECT status, priority, task_type FROM tasks WHERE id = 1")
    .get();
  assert.deepEqual(upgradedTask, {
    status: "pending",
    priority: "medium",
    task_type: "general",
  });

  const integrity = upgradedDb.pragma("integrity_check", { simple: true });
  assert.equal(String(integrity).toLowerCase(), "ok");
  assert.deepEqual(upgradedDb.prepare("PRAGMA foreign_key_check").all(), []);

  const insertedUser = upgradedDb
    .prepare("SELECT email, role, active, login_enabled FROM users WHERE email = ?")
    .get("legacy.admin@example.com");
  assert.deepEqual(insertedUser, {
    email: "legacy.admin@example.com",
    role: "admin",
    active: 1,
    login_enabled: 1,
  });

  const locationStatus = upgradedDb
    .prepare("SELECT status FROM locations WHERE id = 1")
    .get();
  assert.deepEqual(locationStatus, { status: "active" });
});
