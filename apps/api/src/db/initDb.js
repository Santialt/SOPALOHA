const fs = require('fs');
const path = require('path');
const db = require('./connection');

const INITIAL_ADMIN_EMAIL = 'saltamirano@kronsa.com.ar';
const INITIAL_ADMIN_PASSWORD_HASH =
  'scrypt$16384$8$1$de98d699cb43d0664debb90763b3f9d8$c17a14431a4de9349b7ea9730176097c017d0196bd4531991e5b4ff5b01f7d4ab92f52ec3123cafa2048b19a1f2834973aeab726e50d4a6a4bb8f77fea356fdf';

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
  ensureColumn('locations', 'cantidad_licencias_aloha', 'INTEGER');
  ensureColumn('locations', 'tiene_kitchen', 'INTEGER NOT NULL DEFAULT 0 CHECK (tiene_kitchen IN (0, 1))');
  ensureColumn('locations', 'usa_insight_pulse', 'INTEGER NOT NULL DEFAULT 0 CHECK (usa_insight_pulse IN (0, 1))');
  ensureColumn('locations', 'cmc', 'TEXT');
  ensureColumn('locations', 'fecha_apertura', 'TEXT');
  ensureColumn('locations', 'fecha_cierre', 'TEXT');

  ensureColumn('devices', 'windows_version', 'TEXT');
  ensureColumn('devices', 'ram_gb', 'REAL');
  ensureColumn('devices', 'cpu', 'TEXT');
  ensureColumn('devices', 'disk_type', 'TEXT');
  ensureColumn('devices', 'device_role', 'TEXT');
  ensureColumn('incidents', 'created_by', 'INTEGER');
  ensureColumn('incidents', 'updated_by', 'INTEGER');
  ensureColumn('tasks', 'created_by', 'INTEGER');
  ensureColumn('tasks', 'updated_by', 'INTEGER');
  ensureColumn('tasks', 'assigned_user_id', 'INTEGER');
  ensureColumn('location_notes', 'created_by', 'INTEGER');
  ensureColumn('location_notes', 'updated_by', 'INTEGER');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'tech')),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(lower(email));
    CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, active);

    CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
    AFTER UPDATE ON users
    FOR EACH ROW
    BEGIN
      UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY,
      entity_type TEXT NOT NULL CHECK (entity_type IN ('incident', 'task')),
      entity_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      comment TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id, created_at, id);
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned_user_id ON tasks(assigned_user_id);
    CREATE INDEX IF NOT EXISTS idx_incidents_created_by ON incidents(created_by);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
    CREATE INDEX IF NOT EXISTS idx_location_notes_created_by ON location_notes(created_by);

    CREATE TRIGGER IF NOT EXISTS trg_comments_updated_at
    AFTER UPDATE ON comments
    FOR EACH ROW
    BEGIN
      UPDATE comments SET updated_at = datetime('now') WHERE id = NEW.id;
    END;
  `);

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

  if (hasColumn('devices', 'password')) {
    const scrubbedPasswords = db
      .prepare("UPDATE devices SET password = NULL WHERE password IS NOT NULL AND trim(password) <> ''")
      .run().changes;

    if (scrubbedPasswords > 0) {
      console.warn(`[Security] Removed ${scrubbedPasswords} plaintext device password(s) from SQLite.`);
    }
  }

  if (hasColumn('devices', 'device_role')) {
    db.exec('CREATE INDEX IF NOT EXISTS idx_devices_role ON devices(device_role);');
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_devices_location_id ON devices(location_id);
    CREATE INDEX IF NOT EXISTS idx_incidents_location_date ON incidents(location_id, incident_date DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_tasks_location_status ON tasks(location_id, status);
    CREATE INDEX IF NOT EXISTS idx_location_notes_location_created ON location_notes(location_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_teamviewer_imported_cases_started_at ON teamviewer_imported_cases(started_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_teamviewer_imported_cases_location_started ON teamviewer_imported_cases(location_id, started_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_locations_name_search ON locations(lower(name));
    CREATE INDEX IF NOT EXISTS idx_locations_llave_aloha_search ON locations(lower(llave_aloha));
    CREATE INDEX IF NOT EXISTS idx_locations_cuit_search ON locations(lower(cuit));
    CREATE INDEX IF NOT EXISTS idx_locations_razon_social_search ON locations(lower(razon_social));
  `);

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

    CREATE TABLE IF NOT EXISTS on_call_templates (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      crosses_to_next_day INTEGER NOT NULL DEFAULT 0 CHECK (crosses_to_next_day IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_on_call_templates_title ON on_call_templates(title);

    CREATE TRIGGER IF NOT EXISTS trg_on_call_templates_updated_at
    AFTER UPDATE ON on_call_templates
    FOR EACH ROW
    BEGIN
      UPDATE on_call_templates SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

    CREATE TABLE IF NOT EXISTS on_call_technicians (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (name)
    );

    CREATE INDEX IF NOT EXISTS idx_on_call_technicians_active ON on_call_technicians(is_active);

    CREATE TRIGGER IF NOT EXISTS trg_on_call_technicians_updated_at
    AFTER UPDATE ON on_call_technicians
    FOR EACH ROW
    BEGIN
      UPDATE on_call_technicians SET updated_at = datetime('now') WHERE id = NEW.id;
    END;
  `);

  const templateCount = db.prepare('SELECT COUNT(*) AS total FROM on_call_templates').get().total;
  if (templateCount === 0) {
    db.exec(`
      INSERT INTO on_call_templates (title, start_time, end_time, crosses_to_next_day) VALUES
      ('Turno AM', '03:00', '09:00', 0),
      ('Turno Oficina', '09:00', '18:00', 0),
      ('Turno PM', '18:00', '03:00', 1);
    `);
  }

  const techniciansCount = db.prepare('SELECT COUNT(*) AS total FROM on_call_technicians').get().total;
  if (techniciansCount === 0) {
    db.exec(`
      INSERT INTO on_call_technicians (name, is_active) VALUES
      ('Tecnico 1', 1),
      ('Tecnico 2', 1),
      ('Tecnico 3', 1);
    `);
  }
}

function ensureInitialAdminUser() {
  const existing = db
    .prepare('SELECT id, password_hash FROM users WHERE lower(email) = lower(?)')
    .get(INITIAL_ADMIN_EMAIL);
  if (existing) {
    if (!String(existing.password_hash || '').trim()) {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
        INITIAL_ADMIN_PASSWORD_HASH,
        existing.id
      );
    }
    return;
  }

  db.prepare(
    `
    INSERT INTO users (name, email, password_hash, role, active)
    VALUES (?, ?, ?, 'admin', 1)
  `
  ).run('Administrador SOPALOHA', INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD_HASH);
}

function initDatabase() {
  const schemaPath = path.resolve(__dirname, '../../../../docs/sqlite-mvp-schema.sql');

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found at: ${schemaPath}`);
  }

  const sql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(sql);
  runMigrations();
  ensureInitialAdminUser();
  console.log('Database initialized successfully at data/support.db');
}

try {
  initDatabase();
} catch (error) {
  console.error('Database initialization failed:', error.message);
  process.exit(1);
}
