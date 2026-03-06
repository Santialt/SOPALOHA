PRAGMA foreign_keys = ON;

-- =========================================================
-- TABLE: locations
-- Physical branches/stores where support is provided.
-- =========================================================
CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  company_name TEXT,
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
  username TEXT,
  password TEXT,
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
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (location_id) REFERENCES locations(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  FOREIGN KEY (device_id) REFERENCES devices(id)
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
-- TABLE: location_notes
-- Quick technical notes per location.
-- =========================================================
CREATE TABLE IF NOT EXISTS location_notes (
  id INTEGER PRIMARY KEY,
  location_id INTEGER NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (location_id) REFERENCES locations(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
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

CREATE TRIGGER IF NOT EXISTS trg_weekly_tasks_updated_at
AFTER UPDATE ON weekly_tasks
FOR EACH ROW
BEGIN
  UPDATE weekly_tasks SET updated_at = datetime('now') WHERE id = NEW.id;
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

CREATE INDEX IF NOT EXISTS idx_weekly_tasks_status_due ON weekly_tasks(status, due_date);
CREATE INDEX IF NOT EXISTS idx_weekly_tasks_location ON weekly_tasks(location_id);
CREATE INDEX IF NOT EXISTS idx_weekly_tasks_priority ON weekly_tasks(priority);

CREATE INDEX IF NOT EXISTS idx_location_notes_location_created
  ON location_notes(location_id, created_at DESC);

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
