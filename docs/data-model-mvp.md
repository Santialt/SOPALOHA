# Modelo de datos SQLite MVP (Aloha Support local)

## 1) Esquema completo propuesto (MVP)
El esquema final recomendado para el MVP incluye estas tablas:
- `locations`
- `devices`
- `device_aliases`
- `incidents`
- `teamviewer_connections`
- `weekly_tasks`
- `location_notes`

Además:
- Triggers para `updated_at`.
- Índices orientados a búsquedas por local, fecha y matching TeamViewer.
- View `v_daily_location_summary` para generar reporte diario **sin persistir snapshots** en MVP.

El SQL completo está en `docs/sqlite-mvp-schema.sql`.

---

## 2) Decisión de nombre: `locations` vs `stores` vs `clients`
Recomendación: usar **`locations`**.

Motivo:
- Tu unidad operativa real es la **sucursal física** donde intervenís equipos (servidor/cajas/impresoras), no necesariamente el cliente legal.
- `clients` puede confundir cuando una misma empresa tiene múltiples sucursales.
- `stores` es válido, pero `locations` es más neutral y extensible (incluye sucursal, depósito, kitchen central, etc.).

Si después necesitás diferenciar empresa y sucursal, se agrega `companies` y `locations.company_id` sin romper el núcleo.

---

## 3) Tablas y columnas (tipos de dato)

### `locations`
- `id INTEGER PRIMARY KEY`
- `name TEXT NOT NULL`
- `company_name TEXT`
- `address TEXT`
- `city TEXT`
- `province TEXT`
- `phone TEXT`
- `main_contact TEXT`
- `status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive'))`
- `notes TEXT`
- `created_at TEXT NOT NULL DEFAULT datetime('now')`
- `updated_at TEXT NOT NULL DEFAULT datetime('now')`

### `devices`
- `id INTEGER PRIMARY KEY`
- `location_id INTEGER NOT NULL` (FK)
- `name TEXT NOT NULL`
- `type TEXT NOT NULL` (catálogo controlado)
- `ip_address TEXT`
- `teamviewer_id TEXT`
- `username TEXT`
- `password TEXT`
- `operating_system TEXT`
- `sql_version TEXT`
- `sql_instance TEXT`
- `aloha_path TEXT`
- `brand TEXT`
- `model TEXT`
- `notes TEXT`
- `created_at`, `updated_at`

### `device_aliases`
Tabla simple para mejorar matching por nombre de equipo.
- `id INTEGER PRIMARY KEY`
- `device_id INTEGER NOT NULL` (FK)
- `alias TEXT NOT NULL`
- `normalized_alias TEXT GENERATED ALWAYS AS (lower(trim(alias))) VIRTUAL`
- `created_at TEXT NOT NULL DEFAULT datetime('now')`

### `incidents`
- `id INTEGER PRIMARY KEY`
- `location_id INTEGER NOT NULL` (FK)
- `device_id INTEGER` (FK nullable)
- `incident_date TEXT NOT NULL` (`YYYY-MM-DD`)
- `title TEXT NOT NULL`
- `description TEXT NOT NULL`
- `solution TEXT`
- `category TEXT NOT NULL DEFAULT 'other'`
- `time_spent_minutes INTEGER NOT NULL DEFAULT 0`
- `status TEXT NOT NULL DEFAULT 'open'`
- `notes TEXT`
- `created_at`, `updated_at`

### `teamviewer_connections`
- `id INTEGER PRIMARY KEY`
- `connection_date TEXT NOT NULL` (`YYYY-MM-DD`)
- `start_time TEXT NOT NULL` (`HH:MM:SS`)
- `end_time TEXT`
- `duration_minutes INTEGER NOT NULL DEFAULT 0`
- `partner_name TEXT`
- `teamviewer_id TEXT`
- `remote_device_name TEXT`
- `matched_location_id INTEGER` (FK nullable)
- `matched_device_id INTEGER` (FK nullable)
- `match_method TEXT` (`teamviewer_id|device_name|manual|none`)
- `match_confidence INTEGER` (0..100)
- `match_status TEXT` (`matched|suggested|unmatched`)
- `import_file_name TEXT`
- `import_row_hash TEXT` (UNIQUE para deduplicar)
- `raw_csv_row TEXT`
- `created_at TEXT NOT NULL DEFAULT datetime('now')`

### `weekly_tasks`
- `id INTEGER PRIMARY KEY`
- `location_id INTEGER` (FK nullable)
- `title TEXT NOT NULL`
- `description TEXT`
- `priority TEXT NOT NULL DEFAULT 'medium'`
- `status TEXT NOT NULL DEFAULT 'todo'`
- `due_date TEXT`
- `created_at`, `updated_at`

### `location_notes`
- `id INTEGER PRIMARY KEY`
- `location_id INTEGER NOT NULL` (FK)
- `note TEXT NOT NULL`
- `created_at TEXT NOT NULL DEFAULT datetime('now')`

---

## 4) Claves primarias y foráneas
- Todas las tablas usan `id INTEGER PRIMARY KEY`.
- FKs con criterio operativo:
  - `devices.location_id -> locations.id` (`ON DELETE CASCADE`)
  - `incidents.location_id -> locations.id` (`ON DELETE RESTRICT`)
  - `incidents.device_id -> devices.id` (`ON DELETE SET NULL`)
  - `teamviewer_connections.matched_location_id -> locations.id` (`ON DELETE SET NULL`)
  - `teamviewer_connections.matched_device_id -> devices.id` (`ON DELETE SET NULL`)
  - `weekly_tasks.location_id -> locations.id` (`ON DELETE SET NULL`)
  - `location_notes.location_id -> locations.id` (`ON DELETE CASCADE`)

Esto evita perder historial crítico (incidentes/conexiones) cuando se elimina un activo.

---

## 5) Restricciones y validaciones básicas
- Estados y catálogos controlados con `CHECK`.
- Minutos de duración/tiempo con `CHECK (>=0)`.
- `match_confidence` restringido a 0..100.
- `import_row_hash UNIQUE` para evitar duplicados al reimportar CSV.
- `created_at`/`updated_at` automáticos.
- Triggers para refrescar `updated_at` en updates.

Validaciones recomendadas en API (además de DB):
- formato `YYYY-MM-DD` y `HH:MM:SS`
- `teamviewer_id` normalizado (sin espacios)
- `title` y `description` de incidentes no vacíos

---

## 6) Índices recomendados
### Búsquedas por local
- `idx_devices_location_id`
- `idx_incidents_location_date`
- `idx_weekly_tasks_location`
- `idx_location_notes_location_created`

### Búsquedas por fecha
- `idx_incidents_location_date`
- `idx_incidents_status_date`
- `idx_tv_conn_date`
- `idx_weekly_tasks_status_due`

### Matching TeamViewer
- `idx_devices_teamviewer_id`
- `idx_tv_conn_teamviewer_id`
- `idx_tv_conn_remote_name_lower`
- `idx_device_aliases_norm_alias`
- `idx_tv_conn_matched_location`
- `idx_tv_conn_matched_device`

---

## 7) Modelado del matching TeamViewer (simple + útil)
Proceso recomendado por prioridad:

1. **Match por TeamViewer ID (fuerte)**
   - comparar `teamviewer_connections.teamviewer_id` con `devices.teamviewer_id`.
   - si coincide 1 único dispositivo, completar:
     - `matched_device_id`
     - `matched_location_id` (derivado de device)
     - `match_method='teamviewer_id'`
     - `match_confidence=100`
     - `match_status='matched'`

2. **Match por nombre de equipo (sugerido)**
   - comparar `remote_device_name` normalizado contra `devices.name` y `device_aliases.normalized_alias`.
   - si hay 1 candidato fuerte:
     - set `match_method='device_name'`
     - `match_confidence` (ej. 70-90 según regla)
     - `match_status='suggested'`

3. **Match manual (operador)**
   - desde UI elegís local/equipo.
   - set `match_method='manual'`
   - `match_confidence=100`
   - `match_status='matched'`

4. **Sin match**
   - `match_method='none'`, `match_status='unmatched'`

Esto mantiene trazabilidad de cómo fue resuelta cada conexión.

---

## 8) ¿Conviene `daily_reports` / `daily_report_items` en MVP?
Recomendación MVP: **NO persistir reportes diarios** al inicio.

Alternativa más simple:
- generar resumen “on-demand” desde `incidents` + `teamviewer_connections`.
- usar la view `v_daily_location_summary` para base del cálculo.
- agregar “notas manuales del día” como texto libre fuera de DB o en una tabla simple futura si se necesita historial.

Ventaja:
- menos complejidad, menos riesgos de inconsistencia, entrega más rápida.

Cuándo sí agregarlos:
- cuando necesites trazabilidad histórica exacta del texto enviado cada día (snapshot inmutable).

---

## 9) Ejemplos de registros reales

```sql
-- 1) Local
INSERT INTO locations (
  name, company_name, address, city, province, phone, main_contact, status, notes
) VALUES (
  'Aloha Centro', 'Gastronomía Centro S.A.', 'Av. Corrientes 1234', 'CABA', 'Buenos Aires',
  '+54 11 5555-1111', 'María Gómez (Encargada)', 'active', 'Cierre de caja 23:30'
);

-- 2) Dispositivos
INSERT INTO devices (
  location_id, name, type, ip_address, teamviewer_id, username, password,
  operating_system, sql_version, sql_instance, aloha_path, brand, model, notes
) VALUES
(1, 'SRV-ALOHA-CENTRO', 'server', '192.168.10.10', '123456789', 'admin', '***',
 'Windows Server 2019', 'SQL Server 2017', 'SQLEXPRESS', 'C:\\Aloha', 'Dell', 'PowerEdge T40', 'Servidor principal'),
(1, 'POS-CAJA-01', 'pos_terminal', '192.168.10.21', '223344556', 'aloha', '***',
 'Windows 10', NULL, NULL, NULL, 'HP', 'ProDesk 400', 'Caja con ticketera fiscal'),
(1, 'PRN-COMANDA-COCINA', 'kitchen_printer', '192.168.10.40', NULL, NULL, NULL,
 NULL, NULL, NULL, NULL, 'Epson', 'TM-U220', 'Intermitencia por cable de red');

-- Alias para matching por nombre
INSERT INTO device_aliases (device_id, alias) VALUES
(2, 'CAJA1-CENTRO'),
(2, 'POS 1 CENTRO');

-- 3) Incidente típico Aloha
INSERT INTO incidents (
  location_id, device_id, incident_date, title, description, solution, category,
  time_spent_minutes, status, notes
) VALUES (
  1, 2, '2026-03-06',
  'No imprime comanda desde Aloha en Caja 1',
  'Al enviar orden, Aloha muestra spool pero cocina no recibe impresión.',
  'Se reinició cola de impresión, se reinstaló driver TM-U220 y se verificó puerto IP 192.168.10.40. Prueba OK.',
  'printer',
  35,
  'closed',
  'Queda recomendado reemplazar patch cord en cocina.'
);

-- 4) Conexión TeamViewer
INSERT INTO teamviewer_connections (
  connection_date, start_time, end_time, duration_minutes,
  partner_name, teamviewer_id, remote_device_name,
  matched_location_id, matched_device_id,
  match_method, match_confidence, match_status,
  import_file_name, import_row_hash, raw_csv_row
) VALUES (
  '2026-03-06', '11:05:00', '11:42:00', 37,
  'Aloha Centro - Caja 1', '223344556', 'POS-CAJA-01',
  1, 2,
  'teamviewer_id', 100, 'matched',
  'Connections_2026-03-06.csv', 'sha1:9db31d5b...',
  '"2026-03-06","11:05","11:42","37","Aloha Centro - Caja 1","223344556","POS-CAJA-01"'
);
```

---

## 10) SQL completo de creación
El SQL completo (DDL, triggers, índices y view) está en:
- `docs/sqlite-mvp-schema.sql`

Ese archivo se puede ejecutar directamente en SQLite para inicializar la base `data/support.db`.
