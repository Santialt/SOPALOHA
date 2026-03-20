const fs = require("fs");
const path = require("path");
const db = require("./connection");
const { logger } = require("../utils/logger");
const { applySchemaConvergenceMigration } = require("./migrations/003_schema_convergence");

const MIGRATIONS_DIR = path.resolve(__dirname, "migrations");

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function hasTable(tableName) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);

  return Boolean(row);
}

function hasColumn(tableName, columnName) {
  if (!hasTable(tableName)) {
    return false;
  }

  const columns = db
    .prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
    .all();
  return columns.some((column) => column.name === columnName);
}

function addColumn(tableName, columnName, definition) {
  if (hasColumn(tableName, columnName)) {
    return false;
  }

  db.exec(
    `ALTER TABLE ${quoteIdentifier(tableName)} ADD COLUMN ${quoteIdentifier(
      columnName,
    )} ${definition}`,
  );
  return true;
}

function createIndex(sql) {
  db.exec(sql);
}

function seedOnCallDefaults() {
  const templateCount = db
    .prepare("SELECT COUNT(*) AS total FROM on_call_templates")
    .get().total;
  if (templateCount === 0) {
    db.exec(`
      INSERT INTO on_call_templates (title, start_time, end_time, crosses_to_next_day) VALUES
      ('Turno AM', '03:00', '09:00', 0),
      ('Turno Oficina', '09:00', '18:00', 0),
      ('Turno PM', '18:00', '03:00', 1);
    `);
  }

  const techniciansCount = db
    .prepare("SELECT COUNT(*) AS total FROM on_call_technicians")
    .get().total;
  if (techniciansCount === 0) {
    db.exec(`
      INSERT INTO on_call_technicians (name, is_active) VALUES
      ('Tecnico 1', 1),
      ('Tecnico 2', 1),
      ('Tecnico 3', 1);
    `);
  }
}

function scrubLegacyPlaintextPasswords() {
  if (!hasColumn("devices", "password")) {
    return;
  }

  const changes = db
    .prepare(
      "UPDATE devices SET password = NULL WHERE password IS NOT NULL AND trim(password) <> ''",
    )
    .run().changes;

  if (changes > 0) {
    logger.warn("Removed plaintext device passwords from SQLite", {
      scrubbed_passwords: changes,
    });
  }
}

function applyReleaseHardeningMigration() {
  addColumn("locations", "razon_social", "TEXT");
  addColumn("locations", "cuit", "TEXT");
  addColumn("locations", "llave_aloha", "TEXT");
  addColumn("locations", "version_aloha", "TEXT");
  addColumn("locations", "version_modulo_fiscal", "TEXT");
  addColumn(
    "locations",
    "usa_nbo",
    "INTEGER NOT NULL DEFAULT 0 CHECK (usa_nbo IN (0, 1))",
  );
  addColumn("locations", "network_notes", "TEXT");
  addColumn("locations", "cantidad_licencias_aloha", "INTEGER");
  addColumn(
    "locations",
    "tiene_kitchen",
    "INTEGER NOT NULL DEFAULT 0 CHECK (tiene_kitchen IN (0, 1))",
  );
  addColumn(
    "locations",
    "usa_insight_pulse",
    "INTEGER NOT NULL DEFAULT 0 CHECK (usa_insight_pulse IN (0, 1))",
  );
  addColumn("locations", "cmc", "TEXT");
  addColumn("locations", "fecha_apertura", "TEXT");
  addColumn("locations", "fecha_cierre", "TEXT");
  addColumn("locations", "country", "TEXT");

  addColumn("devices", "windows_version", "TEXT");
  addColumn("devices", "ram_gb", "REAL");
  addColumn("devices", "cpu", "TEXT");
  addColumn("devices", "disk_type", "TEXT");
  addColumn("devices", "device_role", "TEXT");

  addColumn("incidents", "created_by", "INTEGER");
  addColumn("incidents", "updated_by", "INTEGER");

  addColumn("tasks", "created_by", "INTEGER");
  addColumn("tasks", "updated_by", "INTEGER");
  addColumn("tasks", "assigned_user_id", "INTEGER");

  addColumn("location_notes", "created_by", "INTEGER");
  addColumn("location_notes", "updated_by", "INTEGER");

  addColumn(
    "teamviewer_imported_cases",
    "technician_user_id",
    "INTEGER REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL",
  );

  addColumn(
    "on_call_shifts",
    "assigned_user_id",
    "INTEGER REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL",
  );
  addColumn(
    "on_call_shifts",
    "backup_assigned_user_id",
    "INTEGER REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL",
  );

  db.exec(`
    UPDATE devices
    SET device_role = 'other'
    WHERE device_role IS NULL OR trim(device_role) = '';
  `);

  createIndex(
    "CREATE INDEX IF NOT EXISTS idx_devices_role ON devices(device_role);",
  );
  createIndex(
    "CREATE INDEX IF NOT EXISTS idx_on_call_shifts_assigned_user_id ON on_call_shifts(assigned_user_id);",
  );
  createIndex(
    "CREATE INDEX IF NOT EXISTS idx_on_call_shifts_backup_assigned_user_id ON on_call_shifts(backup_assigned_user_id);",
  );
  createIndex(
    "CREATE INDEX IF NOT EXISTS idx_teamviewer_imported_cases_location_started ON teamviewer_imported_cases(location_id, started_at DESC, id DESC);",
  );
  createIndex(
    "CREATE INDEX IF NOT EXISTS idx_teamviewer_imported_cases_technician_user_started ON teamviewer_imported_cases(technician_user_id, started_at DESC, id DESC);",
  );
  createIndex(
    "CREATE INDEX IF NOT EXISTS idx_locations_name_search ON locations(lower(name));",
  );
  createIndex(
    "CREATE INDEX IF NOT EXISTS idx_locations_llave_aloha_search ON locations(lower(llave_aloha));",
  );
  createIndex(
    "CREATE INDEX IF NOT EXISTS idx_locations_cuit_search ON locations(lower(cuit));",
  );
  createIndex(
    "CREATE INDEX IF NOT EXISTS idx_locations_razon_social_search ON locations(lower(razon_social));",
  );
  createIndex(
    "CREATE INDEX IF NOT EXISTS idx_incidents_created_by ON incidents(created_by);",
  );
  createIndex(
    "CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);",
  );
  createIndex(
    "CREATE INDEX IF NOT EXISTS idx_tasks_assigned_user_id ON tasks(assigned_user_id);",
  );
  createIndex(
    "CREATE INDEX IF NOT EXISTS idx_location_notes_created_by ON location_notes(created_by);",
  );

  scrubLegacyPlaintextPasswords();
  seedOnCallDefaults();
}

const MIGRATIONS = [
  {
    id: "001_init",
    type: "sql",
    filePath: path.join(MIGRATIONS_DIR, "001_init.sql"),
  },
  {
    id: "002_release_hardening",
    type: "js",
    up: applyReleaseHardeningMigration,
  },
  {
    id: "003_schema_convergence",
    type: "js",
    transactional: false,
    up: applySchemaConvergenceMigration,
  },
];

function ensureMigrationsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('sql', 'js')),
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function readAppliedMigrationIds() {
  ensureMigrationsTable();
  const rows = db
    .prepare("SELECT id FROM schema_migrations ORDER BY id ASC")
    .all();
  return new Set(rows.map((row) => row.id));
}

function executeMigration(migration) {
  if (migration.type === "sql") {
    const sql = fs.readFileSync(migration.filePath, "utf8");
    db.exec(sql);
    return;
  }

  migration.up();
}

function applyPendingMigrations() {
  ensureMigrationsTable();
  const appliedIds = readAppliedMigrationIds();
  const pending = MIGRATIONS.filter(
    (migration) => !appliedIds.has(migration.id),
  );

  for (const migration of pending) {
    if (migration.transactional === false) {
      executeMigration(migration);
      db.prepare("INSERT INTO schema_migrations (id, type) VALUES (?, ?)").run(
        migration.id,
        migration.type,
      );
    } else {
      const apply = db.transaction(() => {
        executeMigration(migration);
        db.prepare("INSERT INTO schema_migrations (id, type) VALUES (?, ?)").run(
          migration.id,
          migration.type,
        );
      });

      apply();
    }

    logger.info("Applied SQLite migration", {
      migration_id: migration.id,
      migration_type: migration.type,
    });
  }

  return getMigrationStatus();
}

function getMigrationStatus() {
  ensureMigrationsTable();
  const rows = db
    .prepare(
      "SELECT id, type, applied_at FROM schema_migrations ORDER BY id ASC",
    )
    .all();
  const appliedIds = new Set(rows.map((row) => row.id));
  const pending = MIGRATIONS.filter(
    (migration) => !appliedIds.has(migration.id),
  );

  return {
    applied: rows,
    pending: pending.map((migration) => ({
      id: migration.id,
      type: migration.type,
    })),
    current: rows.length > 0 ? rows[rows.length - 1].id : null,
    expected: MIGRATIONS.length,
  };
}

module.exports = {
  MIGRATIONS,
  MIGRATIONS_DIR,
  addColumn,
  applyPendingMigrations,
  getMigrationStatus,
  hasColumn,
  hasTable,
};
