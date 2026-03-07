const fs = require('fs');
const path = require('path');
const db = require('./connection');

function hasColumn(tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some((column) => column.name === columnName);
}

function ensureColumn(tableName, columnName, definition) {
  if (!hasColumn(tableName, columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function runMigrations() {
  ensureColumn('locations', 'razon_social', 'TEXT');
  ensureColumn('locations', 'cuit', 'TEXT');
  ensureColumn('locations', 'llave_aloha', 'TEXT');
  ensureColumn('locations', 'version_aloha', 'TEXT');
  ensureColumn('locations', 'version_modulo_fiscal', 'TEXT');
  ensureColumn('locations', 'usa_nbo', 'INTEGER NOT NULL DEFAULT 0 CHECK (usa_nbo IN (0, 1))');
  ensureColumn('locations', 'network_notes', 'TEXT');

  ensureColumn('devices', 'windows_version', 'TEXT');
  ensureColumn('devices', 'ram_gb', 'REAL');
  ensureColumn('devices', 'cpu', 'TEXT');
  ensureColumn('devices', 'disk_type', 'TEXT');
  ensureColumn('devices', 'device_role', 'TEXT');

  db.exec(`
    CREATE TABLE IF NOT EXISTS location_integrations (
      id INTEGER PRIMARY KEY,
      location_id INTEGER NOT NULL,
      integration_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (location_id) REFERENCES locations(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      CHECK (length(trim(integration_name)) > 0),
      UNIQUE (location_id, integration_name)
    );
  `);

  db.exec(`
    UPDATE devices SET device_role = 'other' WHERE device_role IS NULL OR trim(device_role) = '';
    CREATE INDEX IF NOT EXISTS idx_location_integrations_location_id ON location_integrations(location_id);
  `);

  if (hasColumn('devices', 'device_role')) {
    db.exec('CREATE INDEX IF NOT EXISTS idx_devices_role ON devices(device_role);');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS on_call_shifts (
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

    CREATE INDEX IF NOT EXISTS idx_on_call_shifts_range ON on_call_shifts(start_at, end_at);

    CREATE TRIGGER IF NOT EXISTS trg_on_call_shifts_updated_at
    AFTER UPDATE ON on_call_shifts
    FOR EACH ROW
    BEGIN
      UPDATE on_call_shifts SET updated_at = datetime('now') WHERE id = NEW.id;
    END;
  `);
}

function initDatabase() {
  const schemaPath = path.resolve(__dirname, '../../../../docs/sqlite-mvp-schema.sql');

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found at: ${schemaPath}`);
  }

  const sql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(sql);
  runMigrations();
  console.log('Database initialized successfully at data/support.db');
}

try {
  initDatabase();
} catch (error) {
  console.error('Database initialization failed:', error.message);
  process.exit(1);
}
