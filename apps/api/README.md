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
      healthController.js
      locationController.js
      deviceController.js
      incidentController.js
      weeklyTaskController.js
      locationNoteController.js
      teamviewerConnectionController.js
    services/
      locationService.js
      deviceService.js
      incidentService.js
      weeklyTaskService.js
      locationNoteService.js
    repositories/
      locationRepository.js
      deviceRepository.js
      incidentRepository.js
      weeklyTaskRepository.js
      locationNoteRepository.js
    routes/
      locationRoutes.js
      deviceRoutes.js
      incidentRoutes.js
      weeklyTaskRoutes.js
      locationNoteRoutes.js
      teamviewerConnectionRoutes.js
    db/
      connection.js
      initDb.js
    middleware/
      validate.js
      errorHandler.js
      notFound.js
    utils/
      httpError.js
```

## Cómo correr

Desde `apps/api`:

```bash
npm install
npm run db:init
npm run dev
```

Servidor:
- `http://localhost:3001`

## Endpoints base

- `GET /health`
- `GET|POST|GET:id|PUT:id|DELETE:id /locations`
- `GET|POST|GET:id|PUT:id|DELETE:id /devices`
- `GET|POST|GET:id|PUT:id|DELETE:id /incidents`
- `GET|POST|PUT:id|DELETE:id /weekly-tasks`
- `GET|POST|DELETE:id /location-notes`
- `GET /teamviewer-connections` (placeholder, 501)

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

# Listar locations
curl http://localhost:3001/locations

# Crear device
curl -X POST http://localhost:3001/devices \
  -H "Content-Type: application/json" \
  -d '{
    "location_id":1,
    "name":"POS-CAJA-01",
    "type":"pos_terminal",
    "teamviewer_id":"223344556"
  }'

# Crear incidente
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

# Crear weekly task
curl -X POST http://localhost:3001/weekly-tasks \
  -H "Content-Type: application/json" \
  -d '{
    "location_id":1,
    "title":"Revisar backup SQL",
    "priority":"high",
    "status":"todo",
    "due_date":"2026-03-10"
  }'

# Crear note
curl -X POST http://localhost:3001/location-notes \
  -H "Content-Type: application/json" \
  -d '{
    "location_id":1,
    "note":"Caja 3 pierde red intermitentemente"
  }'
```
