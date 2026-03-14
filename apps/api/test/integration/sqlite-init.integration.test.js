const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { resetApiModuleCache } = require("../helpers/apiTestContext");

function getColumnNames(db, tableName) {
  return db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .map((column) => column.name);
}

test("integracion sqlite init y migraciones", async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sopaloha-sqlite-"));
  const sqliteDbPath = path.join(tempDir, "support-init.db");

  process.env.NODE_ENV = "test";
  process.env.SQLITE_DB_PATH = sqliteDbPath;
  process.env.AUTH_SESSION_SECRET = "sqlite-init-secret";

  resetApiModuleCache();

  const db = require("../../src/db/connection");
  const { initDatabase, runMigrations } = require("../../src/db/initDb");

  t.after(() => {
    db.close();
    resetApiModuleCache();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  await t.test("initDatabase es idempotente y no duplica seeds base", () => {
    initDatabase();
    initDatabase();

    const adminCount = db
      .prepare(
        "SELECT COUNT(*) AS total FROM users WHERE lower(email) = lower('saltamirano@kronsa.com.ar')",
      )
      .get().total;
    const templateCount = db
      .prepare("SELECT COUNT(*) AS total FROM on_call_templates")
      .get().total;
    const techniciansCount = db
      .prepare("SELECT COUNT(*) AS total FROM on_call_technicians")
      .get().total;

    assert.equal(adminCount, 1);
    assert.equal(templateCount, 3);
    assert.equal(techniciansCount, 3);
  });

  await t.test(
    "runMigrations adapta un esquema legacy y limpia password plaintext si existe",
    () => {
      db.exec(`
      DROP TABLE IF EXISTS locations;
      DROP TABLE IF EXISTS devices;
      DROP TABLE IF EXISTS incidents;
      DROP TABLE IF EXISTS tasks;
      DROP TABLE IF EXISTS location_notes;
      DROP TABLE IF EXISTS teamviewer_imported_cases;
      DROP TABLE IF EXISTS users;
      DROP TABLE IF EXISTS comments;
      DROP TABLE IF EXISTS on_call_shifts;
      DROP TABLE IF EXISTS on_call_templates;
      DROP TABLE IF EXISTS on_call_technicians;
      DROP TABLE IF EXISTS location_integrations;

      CREATE TABLE locations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active'
      );

      CREATE TABLE devices (
        id INTEGER PRIMARY KEY,
        location_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        password TEXT
      );

      CREATE TABLE incidents (
        id INTEGER PRIMARY KEY,
        location_id INTEGER NOT NULL,
        incident_date TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'other',
        status TEXT NOT NULL DEFAULT 'open',
        time_spent_minutes INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        location_id INTEGER,
        status TEXT NOT NULL DEFAULT 'pending',
        priority TEXT NOT NULL DEFAULT 'medium'
      );

      CREATE TABLE location_notes (
        id INTEGER PRIMARY KEY,
        location_id INTEGER NOT NULL,
        note TEXT NOT NULL,
        created_at TEXT
      );

      CREATE TABLE teamviewer_imported_cases (
        id INTEGER PRIMARY KEY,
        external_connection_id TEXT NOT NULL UNIQUE,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        duration_seconds INTEGER,
        teamviewer_group_name TEXT NOT NULL,
        note_raw TEXT NOT NULL,
        problem_description TEXT NOT NULL,
        requested_by TEXT NOT NULL,
        location_id INTEGER,
        linked_incident_id INTEGER,
        raw_payload_json TEXT
      );

      INSERT INTO locations (id, name, status) VALUES (1, 'Legacy Local', 'active');
      INSERT INTO devices (id, location_id, name, type, password) VALUES (1, 1, 'Legacy Device', 'other', 'secret');
    `);

      runMigrations();

      const locationColumns = getColumnNames(db, "locations");
      const deviceColumns = getColumnNames(db, "devices");
      const incidentColumns = getColumnNames(db, "incidents");
      const taskColumns = getColumnNames(db, "tasks");
      const noteColumns = getColumnNames(db, "location_notes");
      const scrubbedPassword = db
        .prepare("SELECT password FROM devices WHERE id = 1")
        .get().password;

      assert.ok(locationColumns.includes("razon_social"));
      assert.ok(locationColumns.includes("fecha_cierre"));
      assert.ok(deviceColumns.includes("device_role"));
      assert.ok(deviceColumns.includes("windows_version"));
      assert.ok(incidentColumns.includes("created_by"));
      assert.ok(taskColumns.includes("assigned_user_id"));
      assert.ok(noteColumns.includes("created_by"));
      assert.equal(scrubbedPassword, null);
    },
  );
});
