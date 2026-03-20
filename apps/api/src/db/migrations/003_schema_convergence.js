const crypto = require("crypto");
const db = require("../connection");
const { logger } = require("../../utils/logger");
const { hashPassword } = require("../../utils/passwords");

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

  return db
    .prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
    .all()
    .some((column) => column.name === columnName);
}

function randomPasswordHash() {
  return hashPassword(crypto.randomBytes(48).toString("hex"));
}

function normalizeSql(sql) {
  return String(sql || "")
    .replace(/\s+/g, " ")
    .replace(/`/g, '"')
    .trim()
    .toLowerCase();
}

function getTableSql(tableName) {
  return normalizeSql(
    db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
      )
      .get(tableName)?.sql,
  );
}

function getIndexSnapshot(tableName) {
  return db
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
    .all(tableName)
    .map((row) => ({
      name: row.name,
      sql: normalizeSql(row.sql),
    }));
}

function getColumnSnapshot(tableName) {
  return db
    .prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
    .all()
    .map((column) => ({
      name: column.name,
      type: normalizeSql(column.type),
      notnull: column.notnull,
      dflt_value: normalizeSql(column.dflt_value),
      pk: column.pk,
    }));
}

function getTriggerSnapshot(tableName) {
  return db
    .prepare(
      `
      SELECT name, sql
      FROM sqlite_master
      WHERE type = 'trigger'
        AND tbl_name = ?
      ORDER BY name ASC
    `,
    )
    .all(tableName)
    .map((row) => ({
      name: row.name,
      sql: normalizeSql(row.sql),
    }));
}

function assertSchemaShape(tableName, expected) {
  const actualTableSql = getTableSql(tableName);
  const actualColumns = JSON.stringify(getColumnSnapshot(tableName));
  const expectedColumns = JSON.stringify(expected.columns);
  if (actualColumns !== expectedColumns) {
    throw new Error(
      `schema convergence mismatch for ${tableName}: column definition does not match expected shape`,
    );
  }

  for (const fragment of expected.requiredSqlFragments || []) {
    if (!actualTableSql.includes(normalizeSql(fragment))) {
      throw new Error(
        `schema convergence mismatch for ${tableName}: missing required SQL fragment '${fragment}'`,
      );
    }
  }

  const actualIndexes = new Set(getIndexSnapshot(tableName).map((index) => index.name));
  for (const statement of expected.postCreateStatements.filter((sql) => /^\s*create\s+index/i.test(sql))) {
    const expectedIndexName =
      statement.match(/create\s+index\s+if\s+not\s+exists\s+("?[\w_]+"?)/i)?.[1]
        ?.replace(/"/g, "") || null;
    if (!expectedIndexName || !actualIndexes.has(expectedIndexName)) {
      throw new Error(
        `schema convergence mismatch for ${tableName}: missing expected index '${expectedIndexName}'`,
      );
    }
  }

  const actualTriggers = new Set(getTriggerSnapshot(tableName).map((trigger) => trigger.name));
  for (const statement of expected.postCreateStatements.filter((sql) => /^\s*create\s+trigger/i.test(sql))) {
    const expectedTriggerName =
      statement.match(/create\s+trigger\s+if\s+not\s+exists\s+("?[\w_]+"?)/i)?.[1]
        ?.replace(/"/g, "") || null;
    if (!expectedTriggerName || !actualTriggers.has(expectedTriggerName)) {
      throw new Error(
        `schema convergence mismatch for ${tableName}: missing expected trigger '${expectedTriggerName}'`,
      );
    }
  }
}

function sourceColumn(tableName, columnName, fallback = "NULL") {
  return hasColumn(tableName, columnName)
    ? quoteIdentifier(columnName)
    : fallback;
}

function assertNoDuplicateNormalizedValues(tableName, columnName, label) {
  const duplicates = db
    .prepare(
      `
      SELECT lower(trim(${quoteIdentifier(columnName)})) AS normalized_value, COUNT(*) AS total
      FROM ${quoteIdentifier(tableName)}
      GROUP BY lower(trim(${quoteIdentifier(columnName)}))
      HAVING normalized_value IS NOT NULL
         AND normalized_value <> ''
         AND COUNT(*) > 1
      ORDER BY total DESC, normalized_value ASC
      LIMIT 1
    `,
    )
    .get();

  if (duplicates) {
    throw new Error(
      `${label} contains duplicate values after normalization: '${duplicates.normalized_value}'`,
    );
  }
}

function assertNoRows(tableName, whereSql, params, message) {
  const row = db
    .prepare(
      `SELECT * FROM ${quoteIdentifier(tableName)} WHERE ${whereSql} LIMIT 1`,
    )
    .get(params);

  if (row) {
    throw new Error(`${message}: ${JSON.stringify(row)}`);
  }
}

function validateLegacyUsersForConvergence() {
  if (!hasTable("users")) {
    return;
  }

  assertNoDuplicateNormalizedValues("users", "email", "users.email");
  assertNoRows(
    "users",
    "trim(coalesce(name, '')) = ''",
    {},
    "users contains blank names that cannot satisfy NOT NULL/meaningful auth constraints",
  );
  assertNoRows(
    "users",
    "trim(coalesce(email, '')) = ''",
    {},
    "users contains blank emails that cannot satisfy UNIQUE(email)",
  );
  assertNoRows(
    "users",
    "trim(coalesce(password_hash, '')) = ''",
    {},
    "users contains blank password_hash values",
  );
  assertNoRows(
    "users",
    "lower(trim(coalesce(role, ''))) NOT IN ('admin', 'tech')",
    {},
    "users contains unsupported role values",
  );
  assertNoRows(
    "users",
    "active IS NOT NULL AND CAST(active AS INTEGER) NOT IN (0, 1)",
    {},
    "users contains unsupported active values",
  );
}

function validateLegacyLocationsForConvergence() {
  if (!hasTable("locations")) {
    return;
  }

  assertNoRows(
    "locations",
    "trim(coalesce(name, '')) = ''",
    {},
    "locations contains blank names",
  );
  assertNoRows(
    "locations",
    "status IS NOT NULL AND lower(trim(coalesce(status, ''))) NOT IN ('active', 'inactive')",
    {},
    "locations contains unsupported status values",
  );
}

function rebuildTable(definition) {
  if (!hasTable(definition.name)) {
    db.exec(definition.createSql);
    for (const statement of definition.postCreateStatements) {
      db.exec(statement);
    }
    return;
  }

  const legacyName = `${definition.name}__legacy_003`;
  db.exec(
    `ALTER TABLE ${quoteIdentifier(definition.name)} RENAME TO ${quoteIdentifier(legacyName)};`,
  );
  db.exec(definition.createSql);
  const copySql =
    typeof definition.copySql === "function"
      ? definition.copySql(legacyName)
      : definition.copySql.replaceAll(
          "__LEGACY_TABLE__",
          quoteIdentifier(legacyName),
        );
  db.exec(copySql);
  db.exec(`DROP TABLE ${quoteIdentifier(legacyName)};`);

  for (const statement of definition.postCreateStatements) {
    db.exec(statement);
  }
}

function hardenLegacyImportedUsers() {
  const result = db
    .prepare(
      `
      UPDATE users
      SET
        active = 0,
        password_hash = @password_hash
      WHERE lower(trim(email)) LIKE '%@teamviewer.local'
    `,
    )
    .run({
      password_hash: randomPasswordHash(),
    });

  if (result.changes > 0) {
    logger.warn(
      "Disabled legacy TeamViewer-imported users and rotated stored login material",
      {
        affected_users: result.changes,
      },
    );
  }
}

function applySchemaConvergenceMigration() {
  validateLegacyUsersForConvergence();
  validateLegacyLocationsForConvergence();
  const locationsDefinition = {
    name: "locations",
    columns: [
      { name: "id", type: "integer", notnull: 0, dflt_value: "", pk: 1 },
      { name: "name", type: "text", notnull: 1, dflt_value: "", pk: 0 },
      { name: "company_name", type: "text", notnull: 0, dflt_value: "", pk: 0 },
      { name: "razon_social", type: "text", notnull: 0, dflt_value: "", pk: 0 },
      { name: "cuit", type: "text", notnull: 0, dflt_value: "", pk: 0 },
      { name: "llave_aloha", type: "text", notnull: 0, dflt_value: "", pk: 0 },
      { name: "version_aloha", type: "text", notnull: 0, dflt_value: "", pk: 0 },
      { name: "version_modulo_fiscal", type: "text", notnull: 0, dflt_value: "", pk: 0 },
      { name: "usa_nbo", type: "integer", notnull: 1, dflt_value: "0", pk: 0 },
      { name: "network_notes", type: "text", notnull: 0, dflt_value: "", pk: 0 },
      { name: "address", type: "text", notnull: 0, dflt_value: "", pk: 0 },
      { name: "city", type: "text", notnull: 0, dflt_value: "", pk: 0 },
      { name: "province", type: "text", notnull: 0, dflt_value: "", pk: 0 },
      { name: "phone", type: "text", notnull: 0, dflt_value: "", pk: 0 },
      { name: "main_contact", type: "text", notnull: 0, dflt_value: "", pk: 0 },
      { name: "status", type: "text", notnull: 1, dflt_value: "'active'", pk: 0 },
      { name: "notes", type: "text", notnull: 0, dflt_value: "", pk: 0 },
      { name: "cantidad_licencias_aloha", type: "integer", notnull: 0, dflt_value: "", pk: 0 },
      { name: "tiene_kitchen", type: "integer", notnull: 1, dflt_value: "0", pk: 0 },
      { name: "usa_insight_pulse", type: "integer", notnull: 1, dflt_value: "0", pk: 0 },
      { name: "cmc", type: "text", notnull: 0, dflt_value: "", pk: 0 },
      { name: "fecha_apertura", type: "text", notnull: 0, dflt_value: "", pk: 0 },
      { name: "fecha_cierre", type: "text", notnull: 0, dflt_value: "", pk: 0 },
      { name: "created_at", type: "text", notnull: 1, dflt_value: "datetime('now')", pk: 0 },
      { name: "updated_at", type: "text", notnull: 1, dflt_value: "datetime('now')", pk: 0 },
      { name: "country", type: "text", notnull: 0, dflt_value: "", pk: 0 },
    ],
    requiredSqlFragments: [
      "check (status in ('active', 'inactive'))",
      "check (usa_nbo in (0, 1))",
      "check (tiene_kitchen in (0, 1))",
      "check (usa_insight_pulse in (0, 1))",
    ],
    createSql: `
      CREATE TABLE locations (
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
        cantidad_licencias_aloha INTEGER,
        tiene_kitchen INTEGER NOT NULL DEFAULT 0 CHECK (tiene_kitchen IN (0, 1)),
        usa_insight_pulse INTEGER NOT NULL DEFAULT 0 CHECK (usa_insight_pulse IN (0, 1)),
        cmc TEXT,
        fecha_apertura TEXT,
        fecha_cierre TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        country TEXT
      );
    `,
    copySql: (legacyName) => `
      INSERT INTO locations (
        id, name, company_name, razon_social, cuit, llave_aloha, version_aloha, version_modulo_fiscal,
        usa_nbo, network_notes, address, city, province, phone, main_contact, status, notes,
        cantidad_licencias_aloha, tiene_kitchen, usa_insight_pulse, cmc, fecha_apertura, fecha_cierre,
        created_at, updated_at, country
      )
      SELECT
        id,
        trim(name),
        ${sourceColumn(legacyName, "company_name", "NULL")},
        ${sourceColumn(legacyName, "razon_social", "NULL")},
        ${sourceColumn(legacyName, "cuit", "NULL")},
        ${sourceColumn(legacyName, "llave_aloha", "NULL")},
        ${sourceColumn(legacyName, "version_aloha", "NULL")},
        ${sourceColumn(legacyName, "version_modulo_fiscal", "NULL")},
        CASE
          WHEN CAST(coalesce(${sourceColumn(legacyName, "usa_nbo", "0")}, 0) AS INTEGER) = 1 THEN 1
          ELSE 0
        END,
        ${sourceColumn(legacyName, "network_notes", "NULL")},
        ${sourceColumn(legacyName, "address", "NULL")},
        ${sourceColumn(legacyName, "city", "NULL")},
        ${sourceColumn(legacyName, "province", "NULL")},
        ${sourceColumn(legacyName, "phone", "NULL")},
        ${sourceColumn(legacyName, "main_contact", "NULL")},
        lower(trim(coalesce(${sourceColumn(legacyName, "status", "'active'")}, 'active'))),
        ${sourceColumn(legacyName, "notes", "NULL")},
        ${sourceColumn(legacyName, "cantidad_licencias_aloha", "NULL")},
        CASE
          WHEN CAST(coalesce(${sourceColumn(legacyName, "tiene_kitchen", "0")}, 0) AS INTEGER) = 1 THEN 1
          ELSE 0
        END,
        CASE
          WHEN CAST(coalesce(${sourceColumn(legacyName, "usa_insight_pulse", "0")}, 0) AS INTEGER) = 1 THEN 1
          ELSE 0
        END,
        ${sourceColumn(legacyName, "cmc", "NULL")},
        ${sourceColumn(legacyName, "fecha_apertura", "NULL")},
        ${sourceColumn(legacyName, "fecha_cierre", "NULL")},
        coalesce(${sourceColumn(legacyName, "created_at", "NULL")}, datetime('now')),
        coalesce(${sourceColumn(legacyName, "updated_at", "NULL")}, datetime('now')),
        ${sourceColumn(legacyName, "country", "NULL")}
      FROM ${quoteIdentifier(legacyName)};
    `,
    postCreateStatements: [
      "CREATE TRIGGER IF NOT EXISTS trg_locations_updated_at AFTER UPDATE ON locations FOR EACH ROW BEGIN UPDATE locations SET updated_at = datetime('now') WHERE id = NEW.id; END;",
      "CREATE INDEX IF NOT EXISTS idx_locations_name ON locations(name);",
      "CREATE INDEX IF NOT EXISTS idx_locations_status ON locations(status);",
      "CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city);",
      "CREATE INDEX IF NOT EXISTS idx_locations_name_search ON locations(lower(name));",
      "CREATE INDEX IF NOT EXISTS idx_locations_llave_aloha_search ON locations(lower(llave_aloha));",
      "CREATE INDEX IF NOT EXISTS idx_locations_cuit_search ON locations(lower(cuit));",
      "CREATE INDEX IF NOT EXISTS idx_locations_razon_social_search ON locations(lower(razon_social));",
    ],
  };

  const usersDefinition = {
    name: "users",
    columns: [
      { name: "id", type: "integer", notnull: 0, dflt_value: "", pk: 1 },
      { name: "name", type: "text", notnull: 1, dflt_value: "", pk: 0 },
      { name: "email", type: "text", notnull: 1, dflt_value: "", pk: 0 },
      { name: "password_hash", type: "text", notnull: 1, dflt_value: "", pk: 0 },
      { name: "role", type: "text", notnull: 1, dflt_value: "", pk: 0 },
      { name: "active", type: "integer", notnull: 1, dflt_value: "1", pk: 0 },
      { name: "created_at", type: "text", notnull: 1, dflt_value: "datetime('now')", pk: 0 },
      { name: "updated_at", type: "text", notnull: 1, dflt_value: "datetime('now')", pk: 0 },
    ],
    requiredSqlFragments: [
      "email text not null unique",
      "check (role in ('admin', 'tech'))",
      "check (active in (0, 1))",
    ],
    createSql: `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'tech')),
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
    copySql: (legacyName) => `
      INSERT INTO users (
        id, name, email, password_hash, role, active, created_at, updated_at
      )
      SELECT
        id,
        trim(name),
        lower(trim(email)),
        password_hash,
        lower(trim(role)),
        CASE
          WHEN CAST(coalesce(active, 1) AS INTEGER) = 1 THEN 1
          ELSE 0
        END,
        coalesce(${sourceColumn(legacyName, "created_at", "NULL")}, datetime('now')),
        coalesce(${sourceColumn(legacyName, "updated_at", "NULL")}, datetime('now'))
      FROM ${quoteIdentifier(legacyName)};
    `,
    postCreateStatements: [
      "CREATE TRIGGER IF NOT EXISTS trg_users_updated_at AFTER UPDATE ON users FOR EACH ROW BEGIN UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id; END;",
      "CREATE INDEX IF NOT EXISTS idx_users_email ON users(lower(email));",
      "CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, active);",
    ],
  };
  db.exec("PRAGMA foreign_keys = OFF");

  try {
    db.exec("BEGIN IMMEDIATE");
    db.exec("DROP VIEW IF EXISTS v_daily_location_summary;");

    hardenLegacyImportedUsers();

    rebuildTable(locationsDefinition);
    rebuildTable(usersDefinition);

    rebuildTable({
      name: "devices",
      createSql: `
        CREATE TABLE devices (
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
      `,
      copySql: (legacyName) => `
        INSERT INTO devices (
          id, location_id, name, type, ip_address, teamviewer_id, windows_version, ram_gb, cpu, disk_type,
          device_role, username, operating_system, sql_version, sql_instance, aloha_path, brand, model, notes,
          created_at, updated_at
        )
        SELECT
          id,
          location_id,
          name,
          CASE
            WHEN type IN ('server', 'pos_terminal', 'fiscal_printer', 'kitchen_printer', 'pinpad', 'router', 'switch', 'other')
              THEN type
            ELSE 'other'
          END,
          NULLIF(trim(coalesce(${sourceColumn(legacyName, "ip_address", "NULL")}, '')), ''),
          NULLIF(trim(coalesce(${sourceColumn(legacyName, "teamviewer_id", "NULL")}, '')), ''),
          ${sourceColumn(legacyName, "windows_version", "NULL")},
          ${sourceColumn(legacyName, "ram_gb", "NULL")},
          ${sourceColumn(legacyName, "cpu", "NULL")},
          ${sourceColumn(legacyName, "disk_type", "NULL")},
          CASE
            WHEN coalesce(trim(${sourceColumn(legacyName, "device_role", "NULL")}), '') IN ('server', 'pos', 'kitchen_display', 'kitchen_printer', 'fiscal_printer', 'router', 'switch', 'other')
              THEN trim(${sourceColumn(legacyName, "device_role", "NULL")})
            ELSE 'other'
          END,
          ${sourceColumn(legacyName, "username", "NULL")},
          ${sourceColumn(legacyName, "operating_system", "NULL")},
          ${sourceColumn(legacyName, "sql_version", "NULL")},
          ${sourceColumn(legacyName, "sql_instance", "NULL")},
          ${sourceColumn(legacyName, "aloha_path", "NULL")},
          ${sourceColumn(legacyName, "brand", "NULL")},
          ${sourceColumn(legacyName, "model", "NULL")},
          ${sourceColumn(legacyName, "notes", "NULL")},
          coalesce(${sourceColumn(legacyName, "created_at", "NULL")}, datetime('now')),
          coalesce(${sourceColumn(legacyName, "updated_at", "NULL")}, datetime('now'))
        FROM ${quoteIdentifier(legacyName)};
      `,
      postCreateStatements: [
        "CREATE TRIGGER IF NOT EXISTS trg_devices_updated_at AFTER UPDATE ON devices FOR EACH ROW BEGIN UPDATE devices SET updated_at = datetime('now') WHERE id = NEW.id; END;",
        "CREATE INDEX IF NOT EXISTS idx_devices_location_id ON devices(location_id);",
        "CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(type);",
        "CREATE INDEX IF NOT EXISTS idx_devices_teamviewer_id ON devices(teamviewer_id);",
        "CREATE INDEX IF NOT EXISTS idx_devices_name_lower ON devices(lower(name));",
        "CREATE INDEX IF NOT EXISTS idx_devices_role ON devices(device_role);",
      ],
    });

    rebuildTable({
      name: "incidents",
      createSql: `
        CREATE TABLE incidents (
          id INTEGER PRIMARY KEY,
          location_id INTEGER NOT NULL,
          device_id INTEGER,
          incident_date TEXT NOT NULL,
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
      `,
      copySql: (legacyName) => `
        INSERT INTO incidents (
          id, location_id, device_id, incident_date, title, description, solution, category, time_spent_minutes,
          status, notes, created_by, updated_by, created_at, updated_at
        )
        SELECT
          id,
          location_id,
          ${sourceColumn(legacyName, "device_id", "NULL")},
          incident_date,
          title,
          description,
          ${sourceColumn(legacyName, "solution", "NULL")},
          CASE
            WHEN coalesce(trim(${sourceColumn(legacyName, "category", "'other'")}), '') IN ('network', 'sql', 'aloha', 'printer', 'fiscal', 'hardware', 'other')
              THEN trim(${sourceColumn(legacyName, "category", "'other'")})
            ELSE 'other'
          END,
          CASE
            WHEN typeof(${sourceColumn(legacyName, "time_spent_minutes", "0")}) IN ('integer', 'real') AND ${sourceColumn(legacyName, "time_spent_minutes", "0")} >= 0
              THEN CAST(${sourceColumn(legacyName, "time_spent_minutes", "0")} AS INTEGER)
            ELSE 0
          END,
          CASE
            WHEN coalesce(trim(${sourceColumn(legacyName, "status", "'open'")}), '') IN ('open', 'closed')
              THEN trim(${sourceColumn(legacyName, "status", "'open'")})
            ELSE 'open'
          END,
          ${sourceColumn(legacyName, "notes", "NULL")},
          ${sourceColumn(legacyName, "created_by", "NULL")},
          ${sourceColumn(legacyName, "updated_by", "NULL")},
          coalesce(${sourceColumn(legacyName, "created_at", "NULL")}, datetime('now')),
          coalesce(${sourceColumn(legacyName, "updated_at", "NULL")}, datetime('now'))
        FROM ${quoteIdentifier(legacyName)};
      `,
      postCreateStatements: [
        "CREATE TRIGGER IF NOT EXISTS trg_incidents_updated_at AFTER UPDATE ON incidents FOR EACH ROW BEGIN UPDATE incidents SET updated_at = datetime('now') WHERE id = NEW.id; END;",
        "CREATE INDEX IF NOT EXISTS idx_incidents_location_date ON incidents(location_id, incident_date);",
        "CREATE INDEX IF NOT EXISTS idx_incidents_status_date ON incidents(status, incident_date);",
        "CREATE INDEX IF NOT EXISTS idx_incidents_category ON incidents(category);",
        "CREATE INDEX IF NOT EXISTS idx_incidents_device_id ON incidents(device_id);",
        "CREATE INDEX IF NOT EXISTS idx_incidents_created_by ON incidents(created_by);",
      ],
    });

    rebuildTable({
      name: "tasks",
      createSql: `
        CREATE TABLE tasks (
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
          due_date TEXT,
          scheduled_for TEXT,
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
      `,
      copySql: (legacyName) => `
        INSERT INTO tasks (
          id, title, description, location_id, device_id, incident_id, status, priority, assigned_to, assigned_user_id,
          due_date, scheduled_for, task_type, created_by, updated_by, created_at, updated_at
        )
        SELECT
          id,
          title,
          ${sourceColumn(legacyName, "description", "NULL")},
          ${sourceColumn(legacyName, "location_id", "NULL")},
          ${sourceColumn(legacyName, "device_id", "NULL")},
          ${sourceColumn(legacyName, "incident_id", "NULL")},
          CASE
            WHEN coalesce(trim(${sourceColumn(legacyName, "status", "'pending'")}), '') IN ('pending', 'in_progress', 'blocked', 'done', 'cancelled')
              THEN trim(${sourceColumn(legacyName, "status", "'pending'")})
            ELSE 'pending'
          END,
          CASE
            WHEN coalesce(trim(${sourceColumn(legacyName, "priority", "'medium'")}), '') IN ('low', 'medium', 'high', 'critical')
              THEN trim(${sourceColumn(legacyName, "priority", "'medium'")})
            ELSE 'medium'
          END,
          ${sourceColumn(legacyName, "assigned_to", "NULL")},
          ${sourceColumn(legacyName, "assigned_user_id", "NULL")},
          ${sourceColumn(legacyName, "due_date", "NULL")},
          ${sourceColumn(legacyName, "scheduled_for", "NULL")},
          CASE
            WHEN coalesce(trim(${sourceColumn(legacyName, "task_type", "'general'")}), '') = '' THEN 'general'
            ELSE trim(${sourceColumn(legacyName, "task_type", "'general'")})
          END,
          ${sourceColumn(legacyName, "created_by", "NULL")},
          ${sourceColumn(legacyName, "updated_by", "NULL")},
          coalesce(${sourceColumn(legacyName, "created_at", "NULL")}, datetime('now')),
          coalesce(${sourceColumn(legacyName, "updated_at", "NULL")}, datetime('now'))
        FROM ${quoteIdentifier(legacyName)};
      `,
      postCreateStatements: [
        "CREATE TRIGGER IF NOT EXISTS trg_tasks_updated_at AFTER UPDATE ON tasks FOR EACH ROW BEGIN UPDATE tasks SET updated_at = datetime('now') WHERE id = NEW.id; END;",
        "CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON tasks(status, priority);",
        "CREATE INDEX IF NOT EXISTS idx_tasks_location ON tasks(location_id);",
        "CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);",
        "CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_for ON tasks(scheduled_for);",
        "CREATE INDEX IF NOT EXISTS idx_tasks_incident_id ON tasks(incident_id);",
        "CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);",
        "CREATE INDEX IF NOT EXISTS idx_tasks_assigned_user_id ON tasks(assigned_user_id);",
      ],
    });

    rebuildTable({
      name: "location_notes",
      createSql: `
        CREATE TABLE location_notes (
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
      `,
      copySql: (legacyName) => `
        INSERT INTO location_notes (id, location_id, note, created_by, updated_by, created_at)
        SELECT
          id,
          location_id,
          note,
          ${sourceColumn(legacyName, "created_by", "NULL")},
          ${sourceColumn(legacyName, "updated_by", "NULL")},
          coalesce(${sourceColumn(legacyName, "created_at", "NULL")}, datetime('now'))
        FROM ${quoteIdentifier(legacyName)};
      `,
      postCreateStatements: [
        "CREATE INDEX IF NOT EXISTS idx_location_notes_location_created ON location_notes(location_id, created_at DESC);",
        "CREATE INDEX IF NOT EXISTS idx_location_notes_created_by ON location_notes(created_by);",
      ],
    });

    rebuildTable({
      name: "teamviewer_imported_cases",
      createSql: `
        CREATE TABLE teamviewer_imported_cases (
          id INTEGER PRIMARY KEY,
          external_connection_id TEXT NOT NULL UNIQUE,
          started_at TEXT NOT NULL,
          ended_at TEXT,
          duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
          technician_username TEXT,
          technician_display_name TEXT,
          technician_user_id INTEGER,
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
          FOREIGN KEY (technician_user_id) REFERENCES users(id)
            ON UPDATE CASCADE
            ON DELETE SET NULL,
          FOREIGN KEY (location_id) REFERENCES locations(id)
            ON UPDATE CASCADE
            ON DELETE SET NULL,
          FOREIGN KEY (linked_incident_id) REFERENCES incidents(id)
            ON UPDATE CASCADE
            ON DELETE SET NULL
        );
      `,
      copySql: (legacyName) => `
        INSERT INTO teamviewer_imported_cases (
          id, external_connection_id, started_at, ended_at, duration_seconds, technician_username,
          technician_display_name, technician_user_id, teamviewer_group_name, note_raw, problem_description,
          requested_by, location_id, linked_incident_id, raw_payload_json, imported_at, created_at, updated_at
        )
        SELECT
          id,
          external_connection_id,
          started_at,
          ${sourceColumn(legacyName, "ended_at", "NULL")},
          CASE
            WHEN ${sourceColumn(legacyName, "duration_seconds", "NULL")} IS NULL THEN NULL
            WHEN typeof(${sourceColumn(legacyName, "duration_seconds", "NULL")}) IN ('integer', 'real') AND ${sourceColumn(legacyName, "duration_seconds", "NULL")} >= 0
              THEN CAST(${sourceColumn(legacyName, "duration_seconds", "NULL")} AS INTEGER)
            ELSE NULL
          END,
          ${sourceColumn(legacyName, "technician_username", "NULL")},
          ${sourceColumn(legacyName, "technician_display_name", "NULL")},
          ${sourceColumn(legacyName, "technician_user_id", "NULL")},
          teamviewer_group_name,
          note_raw,
          problem_description,
          requested_by,
          ${sourceColumn(legacyName, "location_id", "NULL")},
          ${sourceColumn(legacyName, "linked_incident_id", "NULL")},
          ${sourceColumn(legacyName, "raw_payload_json", "NULL")},
          coalesce(${sourceColumn(legacyName, "imported_at", "NULL")}, datetime('now')),
          coalesce(${sourceColumn(legacyName, "created_at", "NULL")}, datetime('now')),
          coalesce(${sourceColumn(legacyName, "updated_at", "NULL")}, datetime('now'))
        FROM ${quoteIdentifier(legacyName)};
      `,
      postCreateStatements: [
        "CREATE TRIGGER IF NOT EXISTS trg_teamviewer_imported_cases_updated_at AFTER UPDATE ON teamviewer_imported_cases FOR EACH ROW BEGIN UPDATE teamviewer_imported_cases SET updated_at = datetime('now') WHERE id = NEW.id; END;",
        "CREATE INDEX IF NOT EXISTS idx_tv_imported_cases_started_at ON teamviewer_imported_cases(started_at);",
        "CREATE INDEX IF NOT EXISTS idx_tv_imported_cases_group ON teamviewer_imported_cases(teamviewer_group_name);",
        "CREATE INDEX IF NOT EXISTS idx_tv_imported_cases_technician ON teamviewer_imported_cases(technician_username, technician_display_name);",
        "CREATE INDEX IF NOT EXISTS idx_teamviewer_imported_cases_location_started ON teamviewer_imported_cases(location_id, started_at DESC, id DESC);",
        "CREATE INDEX IF NOT EXISTS idx_teamviewer_imported_cases_technician_user_started ON teamviewer_imported_cases(technician_user_id, started_at DESC, id DESC);",
      ],
    });

    rebuildTable({
      name: "on_call_shifts",
      createSql: `
        CREATE TABLE on_call_shifts (
          id INTEGER PRIMARY KEY,
          title TEXT NOT NULL,
          assigned_to TEXT NOT NULL,
          backup_assigned_to TEXT,
          start_at TEXT NOT NULL,
          end_at TEXT NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          assigned_user_id INTEGER REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
          backup_assigned_user_id INTEGER REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
        );
      `,
      copySql: (legacyName) => `
        INSERT INTO on_call_shifts (
          id, title, assigned_to, backup_assigned_to, start_at, end_at, notes, created_at, updated_at,
          assigned_user_id, backup_assigned_user_id
        )
        SELECT
          id,
          title,
          coalesce(nullif(trim(coalesce(${sourceColumn(legacyName, "assigned_to", "NULL")}, '')), ''), 'Sin asignar'),
          ${sourceColumn(legacyName, "backup_assigned_to", "NULL")},
          start_at,
          end_at,
          ${sourceColumn(legacyName, "notes", "NULL")},
          coalesce(${sourceColumn(legacyName, "created_at", "NULL")}, datetime('now')),
          coalesce(${sourceColumn(legacyName, "updated_at", "NULL")}, datetime('now')),
          ${sourceColumn(legacyName, "assigned_user_id", "NULL")},
          ${sourceColumn(legacyName, "backup_assigned_user_id", "NULL")}
        FROM ${quoteIdentifier(legacyName)};
      `,
      postCreateStatements: [
        "CREATE TRIGGER IF NOT EXISTS trg_on_call_shifts_updated_at AFTER UPDATE ON on_call_shifts FOR EACH ROW BEGIN UPDATE on_call_shifts SET updated_at = datetime('now') WHERE id = NEW.id; END;",
        "CREATE INDEX IF NOT EXISTS idx_on_call_shifts_range ON on_call_shifts(start_at, end_at);",
        "CREATE INDEX IF NOT EXISTS idx_on_call_shifts_assigned_user_id ON on_call_shifts(assigned_user_id);",
        "CREATE INDEX IF NOT EXISTS idx_on_call_shifts_backup_assigned_user_id ON on_call_shifts(backup_assigned_user_id);",
      ],
    });

    db.exec(`
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
    `);

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }

  const fkViolations = db.prepare("PRAGMA foreign_key_check").all();
  if (fkViolations.length > 0) {
    throw new Error(
      `foreign_key_check failed after schema convergence: ${JSON.stringify(fkViolations[0])}`,
    );
  }

  const integrity = db.pragma("integrity_check", { simple: true });
  if (String(integrity).toLowerCase() !== "ok") {
    throw new Error(
      `integrity_check failed after schema convergence: ${integrity}`,
    );
  }

  assertSchemaShape("locations", locationsDefinition);
  assertSchemaShape("users", usersDefinition);
}

module.exports = {
  applySchemaConvergenceMigration,
};
