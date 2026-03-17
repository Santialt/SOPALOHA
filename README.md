# SOPALOHA

Consola interna local-first para soporte operativo de entornos Aloha POS.

## Estado recomendado

Para ambientes nuevos, usar una sola SQLite canonica en:

- [`C:\SOPALOHA\data\support.db`](/C:/SOPALOHA/data/support.db)

La API ya quedo preparada para resolver `SQLITE_DB_PATH=data/support.db` contra la raiz del repo, sin depender del directorio desde el que arranques `npm`.

## Guia rapida

- Deploy estable en servidor nuevo:
  - ver [`docs/deploy-stable.md`](/C:/SOPALOHA/docs/deploy-stable.md)
- Operacion interna y backup/restore:
  - ver [`docs/internal-operations.md`](/C:/SOPALOHA/docs/internal-operations.md)
- Backend API:
  - ver [`apps/api/README.md`](/C:/SOPALOHA/apps/api/README.md)

## Arranque rapido local

```powershell
cd C:\SOPALOHA
npm install
```

Configurar [`apps/api/.env`](/C:/SOPALOHA/apps/api/.env):

```env
PORT=3001
SQLITE_DB_PATH=data/support.db
AUTH_SESSION_SECRET=replace-with-a-random-session-secret
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
INTERNAL_API_KEY=replace-with-a-random-shared-key
```

Inicializar DB y crear admin:

```powershell
cd C:\SOPALOHA
$env:AUTH_SESSION_SECRET="replace-with-a-random-session-secret"
$env:SQLITE_DB_PATH="data/support.db"
npm run db:init --prefix apps/api
npm run admin:create --prefix apps/api -- admin@example.com "Administrador SOPALOHA"
```

Levantar en desarrollo:

```powershell
cd C:\SOPALOHA
npm run dev
```

## Dejar esta version en `main`

Si queres dejar exactamente esta revision como estable:

```powershell
cd C:\SOPALOHA
git status
git add .
git commit -m "Stabilize server deployment and dashboard summary"
git checkout main
git merge --ff-only <tu-rama-actual>
git push origin main
```

Si ya estas parado en `main`, el flujo queda:

```powershell
cd C:\SOPALOHA
git add .
git commit -m "Stabilize server deployment and dashboard summary"
git push origin main
```

Antes del push final, conviene correr:

```powershell
cd C:\SOPALOHA
npm run test:api
```
