# Quality foundation (Phase 1)

## Requisitos

- Node.js 18 o superior
- Dependencias instaladas en raiz, `apps/api` y `apps/web`

Instalacion reproducible desde un clon limpio:

```bash
npm run setup
```

## Comandos locales

Desde `C:\SOPALOHA`:

```bash
npm run lint
npm run format:check:phase1
npm run test
npm run smoke
npm run build
```

Chequeo completo equivalente a CI:

```bash
npm run ci
```

## Alcance

- `lint`: ESLint minimo para `apps/api` y `apps/web`, con exclusiones puntuales de deuda legacy en Web
- `format:check:phase1`: validacion de formato limitada a archivos de tooling, bootstrap y tests incorporados en Phase 1
- `test`: base de tests para API y Web
- `smoke`: arranca el API en modo aislado con SQLite temporal y valida `/health` y login
- `build`: compila `apps/web`

## Seguridad de tests

- El smoke test usa `SQLITE_DB_PATH` apuntando a un archivo temporal fuera de `data/support.db`
- Si `NODE_ENV=test` intenta resolver `data/support.db`, el backend aborta antes de abrir SQLite
- El backend se levanta con `PORT=0` para evitar colisiones
- El smoke limpia/configura explicitamente `INTERNAL_API_KEY` y variables de TeamViewer para no depender del `.env` local
- El test crea su propio usuario local y no usa datos reales
