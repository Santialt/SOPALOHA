# SOPALOHA - Deploy estable en servidor nuevo

## Objetivo

Levantar una instalacion estable de SOPALOHA en Windows usando una unica base SQLite canonica:

- [`C:\SOPALOHA\data\support.db`](/C:/SOPALOHA/data/support.db)

## Archivos a revisar

- [`apps/api/.env`](/C:/SOPALOHA/apps/api/.env)
- [`apps/web/.env`](/C:/SOPALOHA/apps/web/.env)
- [`docs/internal-operations.md`](/C:/SOPALOHA/docs/internal-operations.md)

## 1. Prerrequisitos

- Windows con acceso administrativo
- Node.js LTS
- Git
- TeamViewer instalado solo si esa maquina va a abrir sesiones remotas

## 2. Preparar carpeta de trabajo

```powershell
New-Item -ItemType Directory -Force C:\SOPALOHA
cd C:\SOPALOHA
```

Clonar o copiar el repo dentro de esa carpeta.

## 3. Instalar dependencias

```powershell
cd C:\SOPALOHA
npm install
```

## 4. Crear carpeta de datos canonica

```powershell
New-Item -ItemType Directory -Force C:\SOPALOHA\data
```

## 5. Configurar backend

Editar [`apps/api/.env`](/C:/SOPALOHA/apps/api/.env) y dejar como minimo:

```env
PORT=3001
SQLITE_DB_PATH=data/support.db
AUTH_SESSION_SECRET=poner-un-secreto-largo-y-unico
INTERNAL_API_KEY=poner-una-clave-interna-si-corresponde
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
TEAMVIEWER_API_TOKEN=poner-token-si-corresponde
TEAMVIEWER_REPORTS_API_TOKEN=poner-token-si-corresponde
TEAMVIEWER_TIMEOUT_MS=15000
TEAMVIEWER_MAX_RETRIES=1
```

Notas:

- `SQLITE_DB_PATH=data/support.db` ahora queda fijo contra la raiz del repo.
- Si preferis, podes usar una ruta absoluta como `C:/SOPALOHA/data/support.db`.

## 6. Inicializar base SQLite

```powershell
cd C:\SOPALOHA
$env:AUTH_SESSION_SECRET="poner-un-secreto-largo-y-unico"
$env:SQLITE_DB_PATH="data/support.db"
npm run db:init --prefix apps/api
```

Validacion esperada:

- se crea [`data/support.db`](/C:/SOPALOHA/data/support.db)
- no se crea una base paralela dentro de `apps/api/data`

## 7. Crear admin inicial

```powershell
cd C:\SOPALOHA
$env:AUTH_SESSION_SECRET="poner-un-secreto-largo-y-unico"
$env:SQLITE_DB_PATH="data/support.db"
npm run admin:create --prefix apps/api -- admin@example.com "Administrador SOPALOHA"
```

## 8. Configurar frontend

Editar [`apps/web/.env`](/C:/SOPALOHA/apps/web/.env):

```env
VITE_API_BASE_URL=http://localhost:3001
```

## 9. Validar en modo desarrollo

Backend:

```powershell
cd C:\SOPALOHA
$env:AUTH_SESSION_SECRET="poner-un-secreto-largo-y-unico"
$env:SQLITE_DB_PATH="data/support.db"
npm run dev:api
```

Frontend:

```powershell
cd C:\SOPALOHA
npm run dev:web
```

Validaciones:

- `http://localhost:3001/health` responde `200`
- el login funciona
- el dashboard carga
- TeamViewer import responde si los tokens estan configurados

## 10. Deploy estable

Para dejar frontend compilado:

```powershell
cd C:\SOPALOHA
npm run build
```

El frontend generado queda en:

- [`apps/web/dist`](/C:/SOPALOHA/apps/web/dist)

La API se levanta con:

```powershell
cd C:\SOPALOHA
$env:AUTH_SESSION_SECRET="poner-un-secreto-largo-y-unico"
$env:SQLITE_DB_PATH="data/support.db"
npm run start --prefix apps/api
```

## 11. Backup y restore

Backup:

```powershell
cd C:\SOPALOHA
$env:SQLITE_DB_PATH="data/support.db"
npm run db:backup --prefix apps/api
```

Restore:

1. Detener backend.
2. Reemplazar [`data/support.db`](/C:/SOPALOHA/data/support.db).
3. Borrar `data/support.db-wal` y `data/support.db-shm` si existen.
4. Volver a iniciar backend.
5. Validar `GET /health` y un login real.

## 12. Dejar esta version como estable en `main`

Si los cambios actuales ya son la version estable:

```powershell
cd C:\SOPALOHA
git status
git add .
git commit -m "Stabilize server deployment and dashboard summary"
git checkout main
git merge --ff-only <tu-rama-actual>
git push origin main
```

Si ya estas trabajando sobre `main`:

```powershell
cd C:\SOPALOHA
git add .
git commit -m "Stabilize server deployment and dashboard summary"
git push origin main
```

Chequeos minimos antes de empujar:

```powershell
cd C:\SOPALOHA
npm run test:api
```
