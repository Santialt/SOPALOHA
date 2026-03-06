# Diseño inicial MVP — Soporte Aloha POS (local-first)

## 1. Resumen del enfoque propuesto
Se propone un **monolito modular local-first** (React + Node/Express + SQLite) pensado para correr en Windows con instalación simple, foco en productividad diaria y una curva de crecimiento clara.

La prioridad del MVP será:
1. Centralizar ficha de locales y activos técnicos.
2. Registrar incidentes con solución reusable.
3. Importar CSV de TeamViewer para reducir trabajo manual.
4. Generar un resumen diario semiautomático listo para copiar/pegar.
5. Incorporar una planificación semanal liviana.

Criterio clave: **resolver el 80% del trabajo operativo con el 20% de complejidad técnica**, evitando arquitectura enterprise prematura.

---

## 2. Arquitectura mínima del sistema

### Componentes
- **Frontend (React, desktop-first):** UI interna de operación rápida (listados, formularios, filtros y vistas de detalle).
- **Backend (Node.js + Express):** API REST, validación básica y orquestación de lógica de negocio.
- **DB local (SQLite):** persistencia embebida sin infraestructura extra.
- **Automatizaciones Windows (PowerShell, fase posterior del MVP):** importaciones/atajos operativos y generación asistida de reportes.

### Patrón de arquitectura recomendado
- Monolito por capas:
  - `routes` (HTTP)
  - `controllers` (request/response)
  - `services` (reglas de negocio)
  - `repositories` (acceso SQLite)
  - `validators` (validaciones de payload)

### Ejecución local
- React en `localhost:5173` (o 3000).
- API en `localhost:3001`.
- SQLite como archivo local (`data/support.db`).

### Integraciones MVP
- **CSV TeamViewer** por upload manual desde UI (sin API externa).
- Matching de conexiones con locales/equipos por reglas simples (TeamViewer ID, alias, nombre de equipo).

---

## 3. Estructura de carpetas recomendada

```text
sopaloha/
  apps/
    web/                         # React
      src/
        app/
        modules/
          locales/
          equipos/
          incidentes/
          conexiones/
          reportes/
          planificacion/
        shared/
          components/
          hooks/
          services/              # cliente API
          utils/
        styles/
    api/                         # Node + Express
      src/
        app.js
        server.js
        config/
        db/
          migrations/
          seeds/
        modules/
          locales/
          equipos/
          incidentes/
          conexiones/
          reportes/
          tareas/
        shared/
          middleware/
          validators/
          errors/
          utils/
  scripts/
    powershell/
      import-teamviewer.ps1
      daily-report-helper.ps1
  data/
    support.db
    imports/
  docs/
    mvp-diseno-inicial.md
  package.json
  README.md
```

Notas:
- Separación por módulos de negocio para que crecer sea ordenado.
- `scripts/powershell` queda listo para automatizaciones reales de tu rutina Windows.

---

## 4. Modelo de datos inicial

Modelo orientado a trazabilidad de soporte y reutilización de conocimiento:

- **Local** = unidad principal de atención.
- **Equipo** = activo técnico asociado a un local.
- **Incidente** = evento de soporte con problema/solución.
- **Conexión remota** = registro importado de TeamViewer.
- **Reporte diario** = snapshot editable generado por agregación.
- **Tarea semanal** = planificación operativa.

Principios:
- Normalización razonable (3FN “práctica”, sin exagerar).
- Campos de auditoría (`created_at`, `updated_at`) en tablas principales.
- Uso de catálogos o `CHECK` para estados/tipos clave.

---

## 5. Lista de tablas y relaciones

### `clients` (locales)
- `id` (PK)
- `name` (nombre del local)
- `business_name` (razón social)
- `status` (`active|inactive`)
- `notes`
- `address`
- `city`
- `province`
- `phone`
- `main_contact`
- `created_at`, `updated_at`

### `devices` (equipos)
- `id` (PK)
- `client_id` (FK -> clients.id)
- `internal_name`
- `type` (`server|pos_terminal|fiscal_printer|kitchen_printer|pinpad|router|switch|other`)
- `ip_address`
- `teamviewer_id`
- `username`
- `password` *(MVP: texto plano local; recomendado cifrado en fase 2)*
- `os`
- `sql_version`
- `sql_instance`
- `aloha_path`
- `brand_model`
- `notes`
- `created_at`, `updated_at`

### `incidents`
- `id` (PK)
- `client_id` (FK -> clients.id)
- `device_id` (FK -> devices.id, nullable)
- `incident_date`
- `title`
- `problem_description`
- `applied_solution`
- `time_spent_minutes`
- `status` (`open|in_progress|resolved|closed`)
- `final_notes`
- `created_at`, `updated_at`

### `tv_connections` (TeamViewer import)
- `id` (PK)
- `source_file_name`
- `connection_start`
- `connection_end`
- `duration_seconds`
- `partner_name`
- `partner_id`
- `device_name`
- `session_type`
- `client_id` (FK -> clients.id, nullable)
- `device_id` (FK -> devices.id, nullable)
- `matching_status` (`matched|suggested|unmatched`)
- `raw_payload_json` (fila original para trazabilidad)
- `created_at`

### `daily_reports`
- `id` (PK)
- `report_date` (unique)
- `summary_text` (texto final editable)
- `manual_notes`
- `generated_at`
- `created_at`, `updated_at`

### `daily_report_items`
- `id` (PK)
- `daily_report_id` (FK -> daily_reports.id)
- `client_id` (FK -> clients.id)
- `connections_count`
- `connections_time_seconds`
- `incidents_count`
- `observations`

### `weekly_tasks`
- `id` (PK)
- `client_id` (FK -> clients.id, nullable)
- `title`
- `description`
- `priority` (`low|medium|high|urgent`)
- `status` (`todo|in_progress|blocked|done`)
- `due_date`
- `week_ref` (ej. `2026-W10`)
- `created_at`, `updated_at`

### Relaciones clave
- `clients 1:N devices`
- `clients 1:N incidents`
- `devices 1:N incidents`
- `clients 1:N tv_connections`
- `devices 1:N tv_connections`
- `daily_reports 1:N daily_report_items`
- `clients 1:N daily_report_items`
- `clients 1:N weekly_tasks`

---

## 6. Wireframe textual de pantallas

### A. Dashboard (inicio)
- KPI del día:
  - incidentes abiertos
  - conexiones importadas hoy
  - tiempo remoto total hoy
  - tareas vencidas
- Accesos rápidos:
  - “Nuevo incidente”
  - “Importar CSV TeamViewer”
  - “Generar reporte diario”

### B. Locales
- **Listado** con búsqueda por nombre/ciudad/estado.
- Botón “Nuevo local”.
- En cada fila: ver detalle, editar, desactivar.

### C. Detalle de local (vista principal operativa)
Pestañas:
1. **Ficha general** (datos administrativos + contacto).
2. **Equipos** (tabla + alta/edición rápida).
3. **Incidentes** (historial cronológico filtrable).
4. **Conexiones TeamViewer** (sesiones asociadas).
5. **Tareas** (pendientes del local).

### D. Incidentes
- Tabla con filtros: fecha, estado, local.
- Formulario rápido:
  - local
  - equipo (opcional)
  - problema
  - solución
  - tiempo
  - estado

### E. Importación TeamViewer
- Selector de archivo CSV.
- Preview primeras filas.
- Mapeo de columnas (si cambia formato).
- Resultado:
  - importados
  - duplicados
  - no vinculados
- Acción “aplicar sugerencias de matching”.

### F. Reporte diario
- Selector de fecha.
- Botón “Generar desde datos”.
- Tabla por local: conexiones, tiempo, incidentes.
- Caja de texto final editable (plantilla automática + edición manual).
- Botón “Copiar resumen”.

### G. Planificación semanal
- Vista por semana (lista agrupada por día o prioridad).
- Alta de tarea con local opcional.
- Cambio de estado tipo kanban liviano (sin complejidad visual).

---

## 7. Flujo principal de uso

1. Cargar/actualizar locales.
2. Registrar equipos técnicos por local (TV ID, IP, SO, SQL, ruta Aloha).
3. Durante el día, registrar incidentes con problema y solución aplicada.
4. Al cierre o corte horario, importar CSV de TeamViewer.
5. Revisar conexiones no vinculadas y asociar con sugerencias.
6. Generar reporte diario automático.
7. Editar texto final y copiar para mail/WhatsApp interno.
8. Planificar pendientes para la semana siguiente.

---

## 8. Plan de desarrollo por fases pequeñas

### Fase 0 (0.5 día)
- Bootstrap de proyecto monorepo simple.
- SQLite + migraciones base.
- Layout base de frontend y navegación.

### Fase 1 (1–2 días)
- Módulo Locales CRUD completo.
- Módulo Equipos CRUD por local.
- Validaciones básicas de campos críticos.

### Fase 2 (1–2 días)
- Módulo Incidentes CRUD + filtros.
- Vista detalle de local integrando equipos/incidentes.

### Fase 3 (1–2 días)
- Importador CSV TeamViewer:
  - parser
  - deduplicación
  - matching inicial por TeamViewer ID y alias
  - vista de revisión

### Fase 4 (1 día)
- Generador de reporte diario:
  - agregación incidentes + conexiones
  - plantilla de texto editable
  - copiar al portapapeles

### Fase 5 (1 día)
- Planificación semanal (tareas).
- Ajustes UX para operación diaria.

### Fase 6 (0.5–1 día)
- Hardening MVP:
  - backups básicos de SQLite
  - export CSV de respaldo
  - documentación de uso en Windows

---

## 9. Decisiones técnicas y por qué

1. **SQLite al inicio**
   - Cero costo, cero administración, backup trivial (copiar archivo).
   - Ideal para uso personal local.

2. **Express clásico, sin frameworks pesados**
   - Menor fricción para iterar rápido.
   - Fácil mantenimiento y debugging.

3. **Monolito modular, no microservicios**
   - Menos complejidad operativa.
   - Encaja perfecto con un único operador/entorno local.

4. **Importación TeamViewer por CSV manual (MVP)**
   - Evita dependencia de APIs externas y cambios de proveedor.
   - Te da control y trazabilidad.

5. **Desktop-first con UI sobria**
   - Tu contexto real es productividad operativa en PC.
   - Menos inversión en responsive complejo.

6. **Sin auth compleja en v1**
   - En entorno local personal, overhead innecesario.
   - Se deja hook para añadir login local luego.

7. **Campos técnicos específicos de Aloha en equipos**
   - Acelera diagnóstico remoto (SQL instance, path Aloha, etc.).
   - Reduce tiempo de preguntas repetidas por caso.

Corrección importante de enfoque:
- Guardar contraseñas en claro es riesgoso incluso en local. Para MVP puede aceptarse temporalmente por velocidad, pero conviene planificar pronto cifrado simétrico con clave local (DPAPI/Windows Credential Manager) en fase 2 para reducir exposición.

---

## 10. Riesgos, simplificaciones y cosas que dejarías fuera del MVP

### Riesgos
- Variación del formato CSV de TeamViewer entre versiones.
- Calidad de matching automático (falsos positivos/negativos).
- Acumulación de datos sin backups frecuentes.
- Exposición de credenciales técnicas sensibles.

### Simplificaciones aceptadas en MVP
- Importación manual (no automática por scheduler).
- Matching semiautomático con confirmación humana.
- Reporte diario editable (no 100% automático “perfecto”).
- Sin adjuntos pesados ni gestión documental compleja.

### Fuera del MVP (para no frenar entrega)
- Monitoreo en tiempo real de equipos.
- Ejecución remota de scripts desde la app.
- Integración directa con WhatsApp/mail APIs.
- Motor de reglas avanzado/IA para diagnóstico.
- Multiusuario, permisos y auditoría avanzada.
- Dockerización y despliegue cloud.

---

### Criterio de éxito del MVP (práctico)
Si al final de una jornada podés:
1. encontrar rápido la ficha técnica de cualquier local,
2. registrar y recuperar soluciones frecuentes,
3. importar TeamViewer en menos de 2 minutos,
4. generar un resumen diario utilizable en menos de 5 minutos,
entonces el MVP ya está cumpliendo su objetivo operativo real.
