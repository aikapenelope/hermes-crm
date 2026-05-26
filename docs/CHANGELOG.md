# Changelog — Hermes CRM

Registro completo de lo construido durante el desarrollo activo (mayo 2026).
Ordenado cronológico: lo más reciente al final.

---

## Sesión 1 — Infraestructura base y schema inicial

### Contexto
El objetivo era reemplazar el CRM en React embebido en qyne-v1 con un sistema
standalone más ligero basado en PocketBase + SvelteKit.

### Qué se construyó

**Schema CRM completo** (`1_init_crm.js`):
- 12 colecciones base: tags, companies, pipelines, contacts, deals, tasks,
  activities, notes, products, deal_items, goals + users
- 5 vistas SQL: seg_hot_leads, seg_pipeline_at_risk, seg_cold_contacts,
  seg_revenue_by_source, seg_won_by_owner
- Pipeline por defecto "Sales Pipeline" con 6 etapas (seed automático)
- API rules con autenticación requerida en todas las colecciones

**Problema descubierto: PocketBase v0.22+ cambió la API de migraciones**
- En versiones anteriores: `new Collection({ fields: [...] })` funcionaba
- En v0.22+: los campos deben agregarse con `col.fields.push()` DESPUÉS de
  crear la colección, o se ignoran silenciosamente
- Fix documentado en el comentario de la migración

**SvelteKit 5 SPA:**
- Login page, Dashboard, Contacts, Companies, Deals (Kanban), Tasks, Calendar,
  Emails, Reports, Segments, Settings
- Adapter static → build en `/pb/pb_public/` → servido por PocketBase en el
  mismo origen (sin CORS)

**Dockerfile multi-stage:**
- Stage 1 (node:20-alpine): `npm run build` del UI
- Stage 2 (alpine): descarga PocketBase binary + copia el build del UI
- Non-root user pocketbase (uid 1001)
- wget/unzip eliminados post-install (reducción de attack surface)
- HEALTHCHECK vía `/api/health`

**docker-compose.yml:**
- Perfil `with-caddy` para HTTPS automático
- Volumen para `pb_data`
- `GOMEMLIMIT: 200MiB`

---

## Sesión 2 — Corrección de bugs de producción

### Contexto
Al desplegar en el servidor real (89.167.96.99, Tailscale: 100.120.80.93)
aparecieron múltiples bugs que no se manifestaban en local.

### Bugs encontrados y corregidos

**Bug 1: `pocketbase superuser ips` resetea en cada restart**
- El comando `superuser ips` acepta múltiples IPs
- Pero en el entrypoint no se pasaban correctamente con múltiples valores
- Fix: pasar como `${PB_ADMIN_IPS}` con word splitting intencional

**Bug 2: Email `hermes@internal` rechazado por PocketBase v0.38**
- PocketBase v0.38 exige un email con TLD sintácticamente válido
- `hermes@internal` no tiene TLD → `Error: missing or invalid email address`
- Fix: cambiar a `hermes@crm.internal` o `hermes@aikalabs.cc`
- Documentado en `.env.example` y `hermes-config/`

**Bug 3: `created`/`updated` no se crean automáticamente en colecciones custom**
- PocketBase v0.22+ ya no añade estos campos de forma automática
- Sin ellos, `sort=-created` devuelve HTTP 400 ("Something went wrong")
- `gaspechak-pocketbase-mcp` usa `sort=-created` en TODOS sus `pb_record_list`
- Fix: `5_add_autodate_fields.js` + ALTER TABLE directo en SQLite
  (las migraciones JS en v0.38 no crean columnas físicas — ver issue #11)

**Bug 4: Volumen Docker `pb_data` rechaza escritura (uid mismatch)**
- El container corre como uid 1001 pero el volumen nuevo se crea como root
- PocketBase no puede abrir la base de datos → crash loop
- Fix: `docker run --rm -v vol:/data alpine chown -R 1001:1001 /data`
  Documentado en entrypoint.sh para nuevos despliegues

**Bug 5: `PB_ADMIN_IPS` bloquea Docker bridge (gaspechak MCP → 403)**
- El superuserIPs de PocketBase restringe la API `/api/collections/_superusers/auth-with-password`
- Cuando Hermes corre en Docker, llega desde `172.17.x.x` (bridge), no `127.0.0.1`
- Sin `172.16.0.0/12` en la lista, gaspechak-mcp obtiene 403 en cada auth
- Fix: agregar `172.16.0.0/12` a `PB_ADMIN_IPS`

**Bug 6: Contraseña con `=` se trunca con `cut -d=`**
- `openssl rand -base64 16` genera strings con `=` al final (padding base64)
- `cut -d= -f2` corta en el primer `=`, entregando la contraseña truncada
- El container recibe la contraseña completa pero el usuario humano ve la cortada
- Fix: usar siempre `openssl rand -hex 32` para contraseñas

### Migración 2: Fix SQL en seg_revenue_by_source
- PocketBase rechazaba `SUM(CASE WHEN ...)` como syntax de view collection
- Fix: reescribir con correlated subqueries (equivalente semántico)

### Migración 3: Modelo de dos actores
- `_superusers` (hermes@crm.internal): bypassa todas las API rules, solo para MCP
- `users` (admin@tuempresa.com): sujeto a API rules, para el UI web
- Lock de auto-registro (`createRule: null`)
- Seed del usuario CRM desde env vars `PB_USER_EMAIL` / `PB_USER_PASSWORD`

### Migración 4: email_log + reports
- `email_log`: registros inmutables de Gmail (written by crm-gmail-sync skill)
- `reports`: output de tareas automáticas de Hermes

---

## Sesión 3 — Cambio de imagen Docker + nuevo MCP

### Contexto
La imagen original tenía el CRM en React embebido en qyne-v1.
Se migró al repo `hermes-crm` con imagen GHCR publicada.

### Cambios

**Imagen nueva:** `ghcr.io/aikapenelope/hermes-crm:latest`
- Publicada automáticamente por GitHub Actions en cada push a `main`
- Multi-arch: amd64 + arm64

**MCP nuevo:** `@feirelles/pocketbase-mcp@2.0.0`
- Reemplaza `gaspechak-pocketbase-mcp@2.0.1` (tenía incompatibilidad de schema)
- 26 tools vs 16, respuestas en TOML text (sin structured content issues)
- Requiere init manual: `pocketbase_connect` + `pocketbase_auth_admin`

**Problema de MCP descubierto: incompatibilidad de SDK**
- `gaspechak-pocketbase-mcp@2.0.1` usa TypeScript MCP SDK v1.29
  que devuelve structured content objects en `pb_schema` y `pb_health`
- Hermes v0.14.x Python MCP SDK v1.26 valida con `additionalProperties: False`
- Resultado: `pb_schema` y `pb_health` siempre fallan, activan circuit breaker
- Workaround implementado: SOUL.md instruye a Hermes a no llamar esas tools
- Fix permanente: cambiar a `@feirelles/pocketbase-mcp@2.0.0`

---

## Sesión 4 — UI redesign: tema mono-dark, features principales

### Sistema visual (mono-dark brutalist)
Reemplazo completo del tema por defecto de SvelteKit/Tailwind:
- Background: `#070707`, cards: `#090909`, inputs: transparent
- Solo blanco (`#fff`) para elementos activos, negro para texto en botones primarios
- Sin azul, sin slate. Documentado en `docs/DESIGN_SYSTEM.md`
- Componentes actualizados: Btn, Badge, Sheet, Modal, Input, Select, Textarea,
  FormField, Empty

### Features de UI implementados (Sprint 1)
- **Timeline unificado** en perfil de contacto: activities + notes + tasks + deals
  ordenados cronológicamente, con realtime via `pb.collection().subscribe()`
- **Búsqueda global** en el header: contacts/companies/deals/tasks, 300ms debounce,
  dropdown con categorías
- **Realtime subscriptions** en lista de contactos: Hermes crea un contacto →
  aparece solo sin refresh (PocketBase SSE via JS SDK)
- **Tags visibles + filtro**: badges en lista de contactos, click filtra,
  multi-select en ContactForm
- **Acciones rápidas en deals**: botón "→ siguiente stage" en cada card del Kanban

### Features de UI (Sprint 2)
- **Kanban drag-and-drop en deals**: HTML5 nativo, sin librerías externas
  (dragstart/dragover/drop), optimistic updates con rollback on error
- **Vista Kanban en tareas**: toggle LISTA|KANBAN, 4 columnas, botones ←→
- **Vista Agenda en calendario**: toggle MES|AGENDA, lista por fecha, resumen
- **Página `/companies/[id]`**: detalle empresa con contactos y deals vinculados,
  stats de pipeline y revenue
- **Forecast de ingresos** (`/deals/forecast`): agrupado por `expected_close` mes,
  toggle ponderado/total, grand total summary
- **Bulk actions en contactos**: checkbox column, select-all, cambio masivo de
  estado (batches de 20), exportar CSV de selección
- **Adjuntos en notas**: migration 7, FileField (5 archivos × 5MB),
  FormData upload, thumbnails en timeline
- **Importación CSV/VCF** (`/contacts/import`): drag-drop, parser client-side,
  auto-mapping de columnas, preview, batch import

---

## Sesión 5 — Actividades con fecha, schema improvements

### Migración 6: activities.date + activities.title
**Problema:** Hermes guardaba la fecha de citas en `metadata.datetime` (JSON),
lo que PocketBase no puede filtrar. `sort=-created` y `filter=date>=...` fallaban.
**Fix:**
- `activities.date` (DateField): cuándo ocurre la actividad (distinto de `created`)
- `activities.title` (TextField): título corto para display en calendario
- Requirió ALTER TABLE directo + update de `_collections.fields` JSON

### Migración 7: notes.attachments
- FileField en notes: hasta 5 archivos, 5MB cada uno
- MIME types: imágenes, PDF, texto plano
- Thumbnails automáticos (200×200) para imágenes

### Migración 8: Schema improvements
- `contacts.source`: agregados 'import' y 'csv' como valores válidos
  (la página de importación guardaba 'import' pero el SelectField no lo aceptaba)
- `contacts.whatsapp` (bool): el número está en WhatsApp
- `contacts.city`, `contacts.country`: segmentación geográfica
- `contacts.birthday`: recordatorios y follow-ups personalizados
- `goals.current` (number): progreso actual hacia la meta
- `goals.notes` (text): contexto y observaciones

### Fix: logs.db propiedad de root
- El archivo se creaba como root en algunos despliegues
- PocketBase (uid 1001) no podía escribir → logging silenciosamente roto
- Fix en entrypoint.sh: `touch logs.db` antes de arrancar PocketBase

---

## Sesión 6 — PWA completa

### Manifest
- `theme_color: #070707` (nuestro negro, no slate)
- `display: standalone` + `display_override: standalone, minimal-ui`
- 3 shortcuts: Contactos, Negocios, Tareas
- Iconos any + maskable para Android adaptive icons

### app.html — meta tags completos
- `viewport-fit=cover`: safe area para notch/home indicator iOS
- `apple-mobile-web-app-capable: yes`
- `apple-mobile-web-app-status-bar-style: black-translucent`
- `apple-touch-icon` para home screen iOS
- `overscroll-none` en body (sin bounce en modo PWA)

### Service Worker (SvelteKit built-in, sin paquetes extra)
Estrategia por tipo de request:
- `/api/*` y `/_/`: **siempre network** (nunca cachear datos de PocketBase)
- Assets versionados `/_app/immutable/*`: **cache-first** (hashes en nombres = safe)
- Navegación HTML: **network-first**, fallback al shell cacheado si offline
- Versioned cache names: `shell-{version}` — los caches viejos se eliminan en activate

### Bottom nav bar (mobile PWA)
- 5 tabs: INICIO · CONTACTOS · NEGOCIOS · TAREAS · AGENDA
- `hidden lg:hidden` → solo en mobile
- Active state: rainbow gradient top-line + text-white
- `padding-bottom: env(safe-area-inset-bottom)` para iOS home indicator
- Footer de desktop: `hidden lg:flex` → solo en desktop

### PWAInstall component
- Chrome/Android: usa `beforeinstallprompt` → botón INSTALAR nativo
- iOS Safari: instrucciones "Compartir → Añadir a inicio"
- Dismiss almacenado en localStorage
- Aparece 2s después de la primera visita

---

## Sesión 7 — Performance

### Diagnóstico
| Problema | Impacto |
|---|---|
| PocketBase sin compresión | 406KB raw en cada visita (debería ser ~137KB gzip) |
| Sin Cache-Control headers | Re-descarga todo en cada visita |
| Dashboard con `getFullList` | Descargaba TODOS los registros para obtener solo conteos |

### Fixes implementados

**Vite manual chunks** (`vite.config.ts`):
- `vendor-icons`: lucide-svelte (100KB) separado del código de la app
- `vendor-pb`: pocketbase SDK separado
- Cuando cambia solo una página, el browser solo re-descarga ese chunk

**Dashboard API optimization** (`+page.svelte`):
- Reemplazó 3× `getFullList` por queries específicas:
  - `getList(1,1)` para contar contactos (no descarga registros)
  - `getList(1,200)` con filtros para deals por stage
  - `getList(1,1)` para contar tareas vencidas
- Las 8 queries corren en paralelo con `Promise.all`

**Service Worker** (ya activo):
- Primera visita: descarga completa (406KB sin comprimir)
- Segunda visita y en adelante: **0 bytes** (servido desde SW cache)

**Pendiente para PR futuro:**
- Agregar nginx/caddy como proxy en el Dockerfile
- Con gzip: 406KB → 137KB en primera visita (65% menos)
- Con Cache-Control headers: assets con hash en nombre
  pueden cachearse `max-age=31536000, immutable`

---

## Estado final del repo

### Migraciones
| # | Archivo | Qué hace |
|---|---|---|
| 1 | `1_init_crm.js` | Schema completo: 12 cols + 5 views + seed pipeline |
| 2 | `2_fix_revenue_view.js` | Fix SQL CASE WHEN en seg_revenue_by_source |
| 3 | `3_setup_tenant_auth.js` | Lock registro + seed usuario CRM |
| 4 | `4_add_email_reports.js` | email_log + reports collections |
| 5 | `5_add_autodate_fields.js` | created/updated AutodateField a todas las cols |
| 6 | `6_activities_add_date_title.js` | activities.date + activities.title |
| 7 | `7_notes_add_attachments.js` | notes.attachments FileField |
| 8 | `8_schema_improvements.js` | contacts: whatsapp/city/country/birthday + goals: current/notes |

### PR activo
Toda la sesión de trabajo está en el PR #15 del repo:
`neo/fix-autodate-bridge-ip-f8k2j` → `main`

Cuando se mergee, GitHub Actions reconstruye la imagen GHCR automáticamente.
La nueva imagen incluirá el UI actualizado baked in (ya no se necesita `docker cp`).

### Instancia de producción (qyne-v1 / Mastra)
- **URL:** `http://100.120.80.93:8090/` (Tailscale)
- **Usuario CRM:** `admin@aikalabs.cc` / `Aika2026!`
- **Superuser MCP:** `hermes@aikalabs.cc`
- **Container:** `qyne-pocketbase` en `/opt/qyne-v1/docker-compose.yml`
- **MCP en Hermes:** `crm` via `@feirelles/pocketbase-mcp@2.0.0`

### Issues conocidos documentados
Ver `docs/KNOWN_ISSUES.md` para el roadmap completo.
El issue más crítico: la UI desplegada via `docker cp` se pierde en
`--force-recreate`. Solución: mergear el PR para que la imagen GHCR
incluya el UI actualizado.
