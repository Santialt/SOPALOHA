# SOPALOHA API (MVP)

Backend mínimo en Node.js + Express + SQLite para soporte técnico Aloha POS.

## Estructura de carpetas

```text
apps/api/
  package.json
  README.md
  src/
    app.js
    server.js
    controllers/
    services/
    repositories/
    routes/
    db/
    middleware/
    utils/
```

## Hardening interno

- `GET /health` sigue abierto.
- El resto de la API acepta solo origenes `localhost` o los definidos en `CORS_ALLOWED_ORIGINS`.
- Sin `INTERNAL_API_KEY`, la API queda limitada a loopback y red privada.
- Con `INTERNAL_API_KEY`, la API exige `X-Internal-Api-Key` o `Authorization: Bearer`.
- `POST /support-actions/ping` y `POST /support-actions/teamviewer/open` requieren red interna y, si existe, API key valida.
- `devices.password` queda deprecado: ya no se devuelve ni se persiste, y los valores legados se limpian al iniciar la API.

## Cómo correr

Desde `apps/api`:

```bash
npm install
npm run db:init
npm run dev
```

Servidor:
- `http://localhost:3001`

## Endpoints

- `GET /health`
- `GET|POST|GET:id|PUT:id|DELETE:id /locations`
- `GET|POST|GET:id|PUT:id|DELETE:id /devices`
- `GET|POST|GET:id|PUT:id|DELETE:id /incidents`
- `GET|POST|PUT:id|DELETE:id /weekly-tasks`
- `GET|POST|DELETE:id /location-notes`
- `GET /teamviewer-connections` (placeholder, responde `501`)
- `GET /teamviewer/import-preview`
- `POST /teamviewer/import`

## TeamViewer import (API)

- Requiere `TEAMVIEWER_API_TOKEN` en entorno del backend.
- Para reportes de conexiones (casos importados) se puede usar `TEAMVIEWER_REPORTS_API_TOKEN`.
  - Si no se define, se usa `TEAMVIEWER_API_TOKEN` como fallback.
- `GET /teamviewer/import-preview`:
  - consulta grupos y dispositivos en TeamViewer
  - calcula `locations` nuevos/reutilizados por nombre de grupo
  - calcula `devices` nuevos/duplicados
  - devuelve resumen + warnings sin escribir en DB
- `POST /teamviewer/import`:
  - repite lectura de TeamViewer
  - ejecuta importacion real en transaccion SQLite
  - crea primero `locations` faltantes y luego `devices`
  - evita duplicados y devuelve resumen final

### Decision de teamviewer_id

- `devices.teamviewer_id` usa `remotecontrol_id` como valor operativo principal.
- Motivo: es el identificador mas util para acciones de control remoto desde TeamViewer.
- Si `remotecontrol_id` no viene en el payload, se usa `device_id` como fallback.
- Si tampoco hay ID confiable, la deduplicacion usa fallback por `location + alias`.

## Campos esperados y enums válidos

### `POST/PUT /locations`
- Requerido: `name`
- Opcional: `company_name`, `address`, `city`, `province`, `phone`, `main_contact`, `notes`
- Enum: `status` = `active | inactive`

### `POST/PUT /devices`
- Requerido: `location_id`, `name`, `type`
- Opcional: `ip_address`, `teamviewer_id`, `username`, `password`, `operating_system`, `sql_version`, `sql_instance`, `aloha_path`, `brand`, `model`, `notes`
- Enum: `type` =
  - `server`
  - `pos_terminal`
  - `fiscal_printer`
  - `kitchen_printer`
  - `pinpad`
  - `router`
  - `switch`
  - `other`

### `POST/PUT /incidents`
- Requerido: `location_id`, `incident_date`, `title`, `description`
- Opcional: `device_id`, `solution`, `category`, `time_spent_minutes`, `status`, `notes`
- **Importante:** el campo correcto es `incident_date` (no `date`).
- Formato: `incident_date` = `YYYY-MM-DD`
- Enum: `category` = `network | sql | aloha | printer | fiscal | hardware | other`
- Enum: `status` = `open | closed`

### `POST/PUT /weekly-tasks`
- Requerido: `title`
- Opcional: `location_id`, `description`, `priority`, `status`, `due_date`
- Formato: `due_date` = `YYYY-MM-DD`
- Enum: `priority` = `low | medium | high | urgent`
- Enum: `status` = `todo | in_progress | blocked | done`

### `POST /location-notes`
- Requerido: `location_id`, `note`

## Ejemplos cURL

```bash
# Health
curl http://localhost:3001/health

# Crear location
curl -X POST http://localhost:3001/locations \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Aloha Centro",
    "company_name":"Gastronomía Centro SA",
    "status":"active"
  }'

# Crear device (type en inglés, según enum del schema)
curl -X POST http://localhost:3001/devices \
  -H "Content-Type: application/json" \
  -d '{
    "location_id":1,
    "name":"POS-CAJA-01",
    "type":"pos_terminal",
    "teamviewer_id":"223344556"
  }'

# Crear incidente (usar incident_date, no date)
curl -X POST http://localhost:3001/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "location_id":1,
    "device_id":1,
    "incident_date":"2026-03-06",
    "title":"No imprime comanda",
    "description":"Aloha envía spool pero no imprime",
    "category":"printer",
    "status":"open"
  }'

# Error esperado si enviás date en lugar de incident_date
curl -X POST http://localhost:3001/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "location_id":1,
    "date":"2026-03-06",
    "title":"Campo incorrecto",
    "description":"Test"
  }'
```
