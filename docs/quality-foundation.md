# Quality foundation (Phase 1)

## Requisitos

- Node.js 18 o superior
- Dependencias instaladas en raiz, `apps/api` y `apps/web`

## Comandos locales

Desde `C:\SOPALOHA`:

```bash
npm run lint
npm run format:check
npm run test
npm run smoke
npm run build
```

Chequeo completo equivalente a CI:

```bash
npm run ci
```

## Alcance

- `lint`: ESLint minimo para `apps/api` y `apps/web`
- `format:check`: validacion de formato con Prettier sobre archivos de tooling, bootstrap y tests de Phase 1
- `test`: base de tests para API y Web
- `smoke`: arranca el API en modo aislado con SQLite temporal y valida `/health` y login
- `build`: compila `apps/web`

## Seguridad de tests

- El smoke test usa `SQLITE_DB_PATH` apuntando a un archivo temporal fuera de `data/support.db`
- El backend se levanta con `PORT=0` para evitar colisiones
- El test crea su propio usuario local y no usa datos reales
