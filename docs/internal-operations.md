# SOPALOHA - Operacion Interna

## Deploy interno minimo

- Requisitos:
  - Node.js 20 o superior
  - Acceso de lectura/escritura a `data/`
  - TeamViewer instalado solo si se va a usar `POST /support-actions/teamviewer/open` en esa maquina
- Base canonica recomendada:
  - `C:\SOPALOHA\data\support.db`
- Variables minimas en `apps/api/.env`:
  - `PORT`
  - `SQLITE_DB_PATH=data/support.db` o ruta absoluta equivalente
  - `AUTH_SESSION_SECRET`
  - `INTERNAL_API_KEY`
  - `CORS_ALLOWED_ORIGINS`
  - `TEAMVIEWER_API_TOKEN`
  - `TEAMVIEWER_REPORTS_API_TOKEN` si se usa import de casos
  - `TEAMVIEWER_TIMEOUT_MS` y `TEAMVIEWER_MAX_RETRIES` para tuning fino
- Inicio recomendado:
  - configurar `SQLITE_DB_PATH=data/support.db`
  - `npm install --prefix apps/api`
  - `npm install --prefix apps/web`
  - `npm run db:init --prefix apps/api`
  - `npm run admin:create --prefix apps/api -- admin@example.com "Administrador SOPALOHA"`
  - `npm run build --prefix apps/web`
  - `npm run start --prefix apps/api`

## Logging operativo

- El backend ahora escribe logs JSON por stdout/stderr.
- Cada request incluye `request_id`, metodo, path, status y duracion.
- Los errores devueltos al cliente incluyen `request_id` para correlacion rapida.
- Ante fallos TeamViewer se registra `error_code` y si era reintentable.

## TeamViewer y fallos externos

- Las llamadas al API de TeamViewer usan timeout.
- Hay retry corto solo para timeout, error de red, `408`, `429` y `5xx`.
- Si TeamViewer falla, la API responde con `502` y un `code` como:
  - `TEAMVIEWER_TIMEOUT`
  - `TEAMVIEWER_NETWORK_ERROR`
  - `TEAMVIEWER_RATE_LIMITED`
  - `TEAMVIEWER_UPSTREAM_ERROR`
  - `TEAMVIEWER_AUTH_ERROR`

## Backup SQLite

- Backup manual:
  - `npm run db:backup --prefix apps/api`
- Backup a ruta explicita:
  - `node apps/api/scripts/backup-db.js data/backups/support-manual.db`
- Resultado por defecto:
  - crea un `.db` nuevo en `data/backups/`

## Restore recomendado

1. Detener el backend.
2. Guardar una copia del archivo actual `data/support.db`.
3. Reemplazar `data/support.db` por el backup elegido.
4. Si existen `data/support.db-wal` o `data/support.db-shm`, eliminarlos antes de volver a iniciar.
5. Iniciar backend y validar `GET /health`.
6. Revisar logs de arranque y una consulta funcional basica.

## Modulos incompletos o deshabilitados

- `GET /teamviewer-connections` queda deshabilitado de forma explicita con `410`.
- El camino operativo valido para conexiones importadas es `teamviewer/imported-cases`.
- No se recomienda exponer endpoints placeholder en la UI interna.
