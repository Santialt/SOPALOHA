PRAGMA foreign_keys = ON;

-- =========================================================
-- TABLE: locations
-- Physical branches/stores where support is provided.
-- =========================================================
CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  company_name TEXT,
  razon_social TEXT,
  cuit TEXT,
  llave_aloha TEXT,
  version_aloha TEXT,
  version_modulo_fiscal TEXT,
  usa_nbo INTEGER NOT NULL DEFAULT 0 CHECK (usa_nbo IN (0, 1)),
  network_notes TEXT,
  address TEXT,
  city TEXT,
  province TEXT,
  phone TEXT,
  main_contact TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =========================================================
-- TABLE: devices
-- Technical inventory associated with one location.
-- =========================================================
CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY,
  location_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (
    type IN (
      'server',
      'pos_terminal',
      'fiscal_printer',
      'kitchen_printer',
      'pinpad',
      'router',
      'switch',
      'other'
    )
  ),
  ip_address TEXT,
  teamviewer_id TEXT,
  windows_version TEXT,
  ram_gb REAL,
  cpu TEXT,
  disk_type TEXT,
  device_role TEXT NOT NULL DEFAULT 'other' CHECK (
    device_role IN (
      'server',
      'pos',
      'kitchen_display',
      'kitchen_printer',
      'fiscal_printer',
      'router',
      'switch',
      'other'
    )
  ),
  username TEXT,
  operating_system TEXT,
  sql_version TEXT,
  sql_instance TEXT,
  aloha_path TEXT,
  brand TEXT,
  model TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (location_id) REFERENCES locations(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CHECK (ip_address IS NULL OR length(trim(ip_address)) > 0),
  CHECK (teamviewer_id IS NULL OR length(trim(teamviewer_id)) > 0)
);

-- =========================================================
-- TABLE: location_integrations
-- Flexible integrations enabled per location.
-- =========================================================
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

-- =========================================================
-- TABLE: device_aliases
-- Optional aliases used to improve TeamViewer matching by name.
-- =========================================================
CREATE TABLE IF NOT EXISTS device_aliases (
  id INTEGER PRIMARY KEY,
  device_id INTEGER NOT NULL,
  alias TEXT NOT NULL,
  normalized_alias TEXT GENERATED ALWAYS AS (lower(trim(alias))) VIRTUAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (device_id) REFERENCES devices(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  UNIQUE (device_id, normalized_alias)
);

-- =========================================================
-- TABLE: incidents
-- Support incidents/problems.
-- =========================================================
CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY,
  location_id INTEGER NOT NULL,
  device_id INTEGER,
  incident_date TEXT NOT NULL, -- YYYY-MM-DD
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  solution TEXT,
  category TEXT NOT NULL DEFAULT 'other' CHECK (
    category IN ('network', 'sql', 'aloha', 'printer', 'fiscal', 'hardware', 'other')
  ),
  time_spent_minutes INTEGER NOT NULL DEFAULT 0 CHECK (time_spent_minutes >= 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes TEXT,
  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (location_id) REFERENCES locations(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  FOREIGN KEY (device_id) REFERENCES devices(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

-- =========================================================
-- TABLE: teamviewer_connections
-- Imported sessions from TeamViewer CSV and matching metadata.
-- =========================================================
CREATE TABLE IF NOT EXISTS teamviewer_connections (
  id INTEGER PRIMARY KEY,
  connection_date TEXT NOT NULL, -- YYYY-MM-DD
  start_time TEXT NOT NULL,      -- HH:MM:SS
  end_time TEXT,                 -- HH:MM:SS
  duration_minutes INTEGER NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
  partner_name TEXT,
  teamviewer_id TEXT,
  remote_device_name TEXT,

  matched_location_id INTEGER,
  matched_device_id INTEGER,
  match_method TEXT CHECK (match_method IN ('teamviewer_id', 'device_name', 'manual', 'none')),
  match_confidence INTEGER NOT NULL DEFAULT 0 CHECK (match_confidence BETWEEN 0 AND 100),
  match_status TEXT NOT NULL DEFAULT 'unmatched'
    CHECK (match_status IN ('matched', 'suggested', 'unmatched')),

  import_file_name TEXT,
  import_row_hash TEXT,
  raw_csv_row TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (matched_location_id) REFERENCES locations(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  FOREIGN KEY (matched_device_id) REFERENCES devices(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  UNIQUE (import_row_hash)
);

-- =========================================================
-- TABLE: teamviewer_imported_cases
-- Imported external support cases from TeamViewer connections reports.
-- =========================================================
CREATE TABLE IF NOT EXISTS teamviewer_imported_cases (
  id INTEGER PRIMARY KEY,
  external_connection_id TEXT NOT NULL UNIQUE,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  technician_username TEXT,
  technician_display_name TEXT,
  teamviewer_group_name TEXT NOT NULL,
  note_raw TEXT NOT NULL,
  problem_description TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  location_id INTEGER,
  linked_incident_id INTEGER,
  raw_payload_json TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (location_id) REFERENCES locations(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  FOREIGN KEY (linked_incident_id) REFERENCES incidents(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

-- =========================================================
-- TABLE: weekly_tasks
-- Weekly planning and pending items.
-- =========================================================
CREATE TABLE IF NOT EXISTS weekly_tasks (
  id INTEGER PRIMARY KEY,
  location_id INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'blocked', 'done')),
  due_date TEXT, -- YYYY-MM-DD
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (location_id) REFERENCES locations(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

-- =========================================================
-- TABLE: tasks
-- Operational support tasks (base for future kanban/calendar views).
-- =========================================================
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  location_id INTEGER,
  device_id INTEGER,
  incident_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'blocked', 'done', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  assigned_to TEXT,
  assigned_user_id INTEGER,
  due_date TEXT,      -- YYYY-MM-DD
  scheduled_for TEXT, -- YYYY-MM-DDTHH:MM
  task_type TEXT NOT NULL DEFAULT 'general',
  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (location_id) REFERENCES locations(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  FOREIGN KEY (device_id) REFERENCES devices(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  FOREIGN KEY (incident_id) REFERENCES incidents(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  FOREIGN KEY (assigned_user_id) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

-- =========================================================
-- TABLE: on_call_shifts
-- Operational on-call coverage windows.
-- =========================================================
CREATE TABLE IF NOT EXISTS on_call_shifts (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  assigned_to TEXT NOT NULL,
  backup_assigned_to TEXT,
  start_at TEXT NOT NULL, -- YYYY-MM-DDTHH:MM
  end_at TEXT NOT NULL,   -- YYYY-MM-DDTHH:MM
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =========================================================
-- TABLE: on_call_templates
-- Reusable shift templates (AM/Office/PM/custom).
-- =========================================================
CREATE TABLE IF NOT EXISTS on_call_templates (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  start_time TEXT NOT NULL, -- HH:MM
  end_time TEXT NOT NULL,   -- HH:MM
  crosses_to_next_day INTEGER NOT NULL DEFAULT 0 CHECK (crosses_to_next_day IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =========================================================
-- TABLE: on_call_technicians
-- Predefined technicians for shift assignment.
-- =========================================================
CREATE TABLE IF NOT EXISTS on_call_technicians (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (name)
);

-- =========================================================
-- TABLE: location_notes
-- Quick technical notes per location.
-- =========================================================
CREATE TABLE IF NOT EXISTS location_notes (
  id INTEGER PRIMARY KEY,
  location_id INTEGER NOT NULL,
  note TEXT NOT NULL,
  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (location_id) REFERENCES locations(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

-- =========================================================
-- TABLE: users
-- Basic internal authentication users.
-- =========================================================
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

-- =========================================================
-- TABLE: comments
-- Basic comments for incidents and tasks.
-- =========================================================
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

-- =========================================================
-- TRIGGERS: keep updated_at fresh on updates.
-- =========================================================
CREATE TRIGGER IF NOT EXISTS trg_locations_updated_at
AFTER UPDATE ON locations
FOR EACH ROW
BEGIN
  UPDATE locations SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_devices_updated_at
AFTER UPDATE ON devices
FOR EACH ROW
BEGIN
  UPDATE devices SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_incidents_updated_at
AFTER UPDATE ON incidents
FOR EACH ROW
BEGIN
  UPDATE incidents SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_teamviewer_imported_cases_updated_at
AFTER UPDATE ON teamviewer_imported_cases
FOR EACH ROW
BEGIN
  UPDATE teamviewer_imported_cases SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_weekly_tasks_updated_at
AFTER UPDATE ON weekly_tasks
FOR EACH ROW
BEGIN
  UPDATE weekly_tasks SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_tasks_updated_at
AFTER UPDATE ON tasks
FOR EACH ROW
BEGIN
  UPDATE tasks SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_on_call_shifts_updated_at
AFTER UPDATE ON on_call_shifts
FOR EACH ROW
BEGIN
  UPDATE on_call_shifts SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_on_call_templates_updated_at
AFTER UPDATE ON on_call_templates
FOR EACH ROW
BEGIN
  UPDATE on_call_templates SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_on_call_technicians_updated_at
AFTER UPDATE ON on_call_technicians
FOR EACH ROW
BEGIN
  UPDATE on_call_technicians SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
  UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_comments_updated_at
AFTER UPDATE ON comments
FOR EACH ROW
BEGIN
  UPDATE comments SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- =========================================================
-- INDEXES: performance for operational queries.
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_locations_name ON locations(name);
CREATE INDEX IF NOT EXISTS idx_locations_status ON locations(status);
CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city);

CREATE INDEX IF NOT EXISTS idx_devices_location_id ON devices(location_id);
CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(type);
CREATE INDEX IF NOT EXISTS idx_devices_teamviewer_id ON devices(teamviewer_id);
CREATE INDEX IF NOT EXISTS idx_devices_name_lower ON devices(lower(name));

CREATE INDEX IF NOT EXISTS idx_location_integrations_location_id
  ON location_integrations(location_id);

CREATE INDEX IF NOT EXISTS idx_device_aliases_device_id ON device_aliases(device_id);
CREATE INDEX IF NOT EXISTS idx_device_aliases_norm_alias ON device_aliases(normalized_alias);

CREATE INDEX IF NOT EXISTS idx_incidents_location_date ON incidents(location_id, incident_date);
CREATE INDEX IF NOT EXISTS idx_incidents_status_date ON incidents(status, incident_date);
CREATE INDEX IF NOT EXISTS idx_incidents_category ON incidents(category);
CREATE INDEX IF NOT EXISTS idx_incidents_device_id ON incidents(device_id);

CREATE INDEX IF NOT EXISTS idx_tv_conn_date ON teamviewer_connections(connection_date);
CREATE INDEX IF NOT EXISTS idx_tv_conn_teamviewer_id ON teamviewer_connections(teamviewer_id);
CREATE INDEX IF NOT EXISTS idx_tv_conn_partner_name_lower ON teamviewer_connections(lower(partner_name));
CREATE INDEX IF NOT EXISTS idx_tv_conn_remote_name_lower ON teamviewer_connections(lower(remote_device_name));
CREATE INDEX IF NOT EXISTS idx_tv_conn_match_status ON teamviewer_connections(match_status);
CREATE INDEX IF NOT EXISTS idx_tv_conn_matched_location ON teamviewer_connections(matched_location_id);
CREATE INDEX IF NOT EXISTS idx_tv_conn_matched_device ON teamviewer_connections(matched_device_id);

CREATE INDEX IF NOT EXISTS idx_tv_imported_cases_started_at
  ON teamviewer_imported_cases(started_at);
CREATE INDEX IF NOT EXISTS idx_tv_imported_cases_group
  ON teamviewer_imported_cases(teamviewer_group_name);
CREATE INDEX IF NOT EXISTS idx_tv_imported_cases_technician
  ON teamviewer_imported_cases(technician_username, technician_display_name);

CREATE INDEX IF NOT EXISTS idx_weekly_tasks_status_due ON weekly_tasks(status, due_date);
CREATE INDEX IF NOT EXISTS idx_weekly_tasks_location ON weekly_tasks(location_id);
CREATE INDEX IF NOT EXISTS idx_weekly_tasks_priority ON weekly_tasks(priority);

CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON tasks(status, priority);
CREATE INDEX IF NOT EXISTS idx_tasks_location ON tasks(location_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_for ON tasks(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_tasks_incident_id ON tasks(incident_id);

CREATE INDEX IF NOT EXISTS idx_on_call_shifts_range ON on_call_shifts(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_on_call_templates_title ON on_call_templates(title);
CREATE INDEX IF NOT EXISTS idx_on_call_technicians_active ON on_call_technicians(is_active);

CREATE INDEX IF NOT EXISTS idx_location_notes_location_created
  ON location_notes(location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(lower(email));
CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, active);
CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id, created_at DESC, id DESC);

-- =========================================================
-- VIEW: daily rollup generated on demand (no persisted daily_reports in MVP).
-- =========================================================
CREATE VIEW IF NOT EXISTS v_daily_location_summary AS
SELECT
  d.work_date,
  d.location_id,
  l.name AS location_name,
  COALESCE(d.incidents_count, 0) AS incidents_count,
  COALESCE(d.incident_minutes, 0) AS incident_minutes,
  COALESCE(d.connections_count, 0) AS connections_count,
  COALESCE(d.connection_minutes, 0) AS connection_minutes
FROM (
  SELECT
    incident_date AS work_date,
    location_id,
    COUNT(*) AS incidents_count,
    SUM(time_spent_minutes) AS incident_minutes,
    0 AS connections_count,
    0 AS connection_minutes
  FROM incidents
  GROUP BY incident_date, location_id

  UNION ALL

  SELECT
    connection_date AS work_date,
    matched_location_id AS location_id,
    0 AS incidents_count,
    0 AS incident_minutes,
    COUNT(*) AS connections_count,
    SUM(duration_minutes) AS connection_minutes
  FROM teamviewer_connections
  WHERE matched_location_id IS NOT NULL
  GROUP BY connection_date, matched_location_id
) d
JOIN locations l ON l.id = d.location_id;
