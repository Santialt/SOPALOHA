const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Database = require("better-sqlite3");

test("SQLite initialization is idempotent and upgrades a legacy schema safely", async (t) => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "sopaloha-api-db-init-"),
  );
  const sqliteDbPath = path.join(tempDir, "legacy-support.db");

  const legacyDb = new Database(sqliteDbPath);
  legacyDb.exec(`
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

    INSERT INTO locations (name, status) VALUES ('Legacy Local', 'active');
    INSERT INTO devices (location_id, name, type, password) VALUES (1, 'Legacy Device', 'other', 'plaintext-secret');
  `);
  legacyDb.close();

  process.env.NODE_ENV = "test";
  process.env.SQLITE_DB_PATH = sqliteDbPath;
  process.env.AUTH_SESSION_SECRET = "sopaloha-db-init-secret";
  process.env.AUTH_LOGIN_RATE_LIMIT_MAX = "500";

  const db = require("../../src/db/connection");
  const { initDatabase } = require("../../src/db/initDb");

  t.after(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  initDatabase();
  initDatabase();

  const locationColumns = db.prepare("PRAGMA table_info(locations)").all();
  const deviceColumns = db.prepare("PRAGMA table_info(devices)").all();
  const incidentColumns = db.prepare("PRAGMA table_info(incidents)").all();
  const taskColumns = db.prepare("PRAGMA table_info(tasks)").all();
  const locationNoteColumns = db
    .prepare("PRAGMA table_info(location_notes)")
    .all();
  const importedCaseColumns = db
    .prepare("PRAGMA table_info(teamviewer_imported_cases)")
    .all();
  const onCallShiftColumns = db
    .prepare("PRAGMA table_info(on_call_shifts)")
    .all();

  assert.ok(locationColumns.some((column) => column.name === "llave_aloha"));
  assert.ok(locationColumns.some((column) => column.name === "usa_nbo"));
  assert.ok(deviceColumns.some((column) => column.name === "device_role"));
  assert.ok(deviceColumns.some((column) => column.name === "windows_version"));
  assert.ok(incidentColumns.some((column) => column.name === "created_by"));
  assert.ok(taskColumns.some((column) => column.name === "assigned_user_id"));
  assert.ok(locationNoteColumns.some((column) => column.name === "created_by"));
  assert.ok(
    importedCaseColumns.some((column) => column.name === "technician_user_id"),
  );
  assert.ok(
    onCallShiftColumns.some((column) => column.name === "assigned_user_id"),
  );
  assert.ok(
    onCallShiftColumns.some(
      (column) => column.name === "backup_assigned_user_id",
    ),
  );

  const legacyDevice = db
    .prepare("SELECT password, device_role FROM devices WHERE id = 1")
    .get();
  assert.equal(legacyDevice.password, null);
  assert.equal(legacyDevice.device_role, "other");

  const adminUsers = db
    .prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'")
    .get();
  const templateCount = db
    .prepare("SELECT COUNT(*) AS total FROM on_call_templates")
    .get();
  const technicianCount = db
    .prepare("SELECT COUNT(*) AS total FROM on_call_technicians")
    .get();

  assert.equal(adminUsers.total, 0);
  assert.equal(templateCount.total, 3);
  assert.equal(technicianCount.total, 3);
});
