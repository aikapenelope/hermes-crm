# Hermes CRM

CRM ligero y autónomo construido sobre PocketBase + SvelteKit 5.
Un solo contenedor Docker. Sin PostgreSQL, sin Redis, sin dependencias externas.
Diseñado para funcionar con **Hermes Agent** vía MCP.

---

## Características principales

| Módulo | Descripción |
|---|---|
| **Contactos** | Lista, búsqueda, filtro por estado y tags, importación CSV/VCF |
| **Empresas** | Página de detalle con contactos y deals vinculados |
| **Negocios (Deals)** | Kanban drag-and-drop con 6 etapas + forecast por mes |
| **Tareas** | Vista lista + Kanban con botones ←→ para mover entre columnas |
| **Calendario** | Vista mensual + vista Agenda (lista por fecha con resumen) |
| **Timeline** | Feed unificado por contacto: actividades + notas + tareas + deals |
| **Segmentos** | 5 vistas SQL en tiempo real (hot leads, at-risk, cold contacts…) |
| **Emails** | Log de Gmail sincronizado por el skill crm-gmail-sync |
| **Reportes** | Output de tareas automáticas de Hermes |
| **Metas** | Seguimiento de objetivos con campo de progreso |
| **Productos** | Catálogo de productos/servicios con precios |
| **Búsqueda global** | Header search — busca en todas las colecciones simultáneamente |
| **PWA** | Instalable como app nativa en Android/iOS, offline support |

---

## Stack técnico

```
ghcr.io/aikapenelope/hermes-crm:latest
├── /pb/pocketbase           ← Go binary v0.38.x (~12 MB)
├── /pb/pb_public/           ← SvelteKit 5 SPA compilada (PWA)
│   ├── service-worker.js    ← Offline caching, cache-first para assets
│   └── manifest.json        ← PWA manifest (iconos, shortcuts, standalone)
├── /pb/pb_migrations/       ← 8 migraciones JS (schema completo)
└── /pb/pb_data/             ← VOLUME: SQLite + uploads + logs
    ├── data.db              ← Base de datos principal
    ├── logs.db              ← Request logs (PocketBase nativo)
    └── storage/             ← Archivos subidos (adjuntos de notas)
```

**Frontend:** SvelteKit 5 (Svelte runes), Tailwind CSS v4, TypeScript  
**Backend:** PocketBase v0.38 (Go), SQLite con WAL mode  
**MCP:** `@feirelles/pocketbase-mcp@2.0.0` (26 tools, TOML output)

---

## Inicio rápido

```bash
# 1. Clonar
git clone https://github.com/aikapenelope/hermes-crm.git
cd hermes-crm

# 2. Configurar credenciales
cp .env.example .env
# Editar .env: PB_SUPERUSER_EMAIL, PB_SUPERUSER_PASSWORD,
#              PB_USER_EMAIL, PB_USER_PASSWORD

# 3. Levantar
docker compose up -d

# 4. Acceder
open http://localhost:8090
```

En el primer arranque:
- Las 8 migraciones se aplican automáticamente
- El superuser de Hermes se crea desde env vars
- El usuario del CRM se crea desde env vars
- La SPA SvelteKit se sirve en `/`

---

## Estructura del repositorio

```
hermes-crm/
├── Dockerfile                    ← Multi-stage: build UI + runtime Alpine
├── docker-compose.yml            ← Despliegue standalone con Caddy opcional
├── entrypoint.sh                 ← Configura superuser + IP restriction + arranca PB
├── .env.example                  ← Variables de entorno requeridas
│
├── pb_migrations/                ← 8 migraciones JS (orden garantizado)
│   ├── 1_init_crm.js             ← Schema completo: 12 colecciones + 5 vistas SQL
│   ├── 2_fix_revenue_view.js     ← Fix CASE WHEN en seg_revenue_by_source
│   ├── 3_setup_tenant_auth.js    ← Lock registro público + seed usuario CRM
│   ├── 4_add_email_reports.js    ← email_log + reports collections
│   ├── 5_add_autodate_fields.js  ← created/updated a todas las colecciones
│   ├── 6_activities_add_date_title.js ← date + title para calendar queries
│   ├── 7_notes_add_attachments.js    ← FileField adjuntos en notas
│   └── 8_schema_improvements.js     ← contacts: whatsapp/city/country/birthday
│                                      goals: current + notes
│
├── ui/                           ← SvelteKit 5 SPA
│   ├── src/
│   │   ├── app.html              ← PWA meta tags iOS/Android
│   │   ├── service-worker.ts     ← SW: cache-first assets, network API
│   │   ├── lib/
│   │   │   ├── ui/               ← Componentes: Btn, Badge, Sheet, Modal…
│   │   │   │   ├── GlobalSearch.svelte
│   │   │   │   └── PWAInstall.svelte
│   │   │   ├── forms/            ← ContactForm, DealForm, TaskForm…
│   │   │   └── pb.ts             ← PocketBase client singleton
│   │   └── routes/
│   │       ├── (app)/
│   │       │   ├── +layout.svelte     ← Sidebar + bottom nav PWA
│   │       │   ├── contacts/
│   │       │   │   ├── +page.svelte   ← Lista con tags, bulk actions, realtime
│   │       │   │   ├── [id]/          ← Perfil: timeline unificado
│   │       │   │   └── import/        ← CSV/VCF import page
│   │       │   ├── deals/
│   │       │   │   ├── +page.svelte   ← Kanban drag-and-drop
│   │       │   │   └── forecast/      ← Proyección por mes
│   │       │   ├── companies/
│   │       │   │   ├── +page.svelte
│   │       │   │   └── [id]/          ← Detalle empresa
│   │       │   ├── tasks/+page.svelte ← Lista + Kanban toggle
│   │       │   └── calendar/+page.svelte ← Mes + Agenda toggle
│   │       └── login/+page.svelte
│   ├── static/
│   │   ├── manifest.json         ← PWA: standalone, shortcuts, icons
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   └── vite.config.ts            ← Manual chunks: lucide + pocketbase vendor
│
├── hermes-config/
│   ├── mcp-snippet.yaml          ← Config lista para pegar en Hermes
│   ├── README.md                 ← Guía de instalación del MCP + known issues
│   └── skills/crm-gmail-sync/    ← Skill para sincronizar Gmail → email_log
│
├── docs/
│   ├── DESIGN_SYSTEM.md          ← Paleta, tipografía, componentes
│   ├── FEATURE_IMPLEMENTATION.md ← PocketBase API patterns para cada feature
│   ├── KNOWN_ISSUES.md           ← Bugs documentados + roadmap
│   ├── CHANGELOG.md              ← Historial completo de lo que se construyó
│   └── DEPLOYMENT.md             ← Guía de despliegue paso a paso
│
└── MULTI_TENANT_SECURITY.md      ← Arquitectura de aislamiento multi-tenant
```

---

## Schema de colecciones

| Colección | Campos clave |
|---|---|
| `contacts` | name, email, phone, status, source, whatsapp, city, country, birthday, tags→, company→ |
| `companies` | name, industry, website, city, country, size |
| `deals` | title, value, currency, stage, probability, expected_close, contact→, company→, pipeline→ |
| `pipelines` | name, stages (JSON), is_default |
| `tasks` | title, type, status, priority, due_date, contact→, deal→, assigned_to→ |
| `activities` | type, title, date (datetime), description, contact→, deal→, metadata (JSON) |
| `notes` | content, pinned, attachments (files), contact→, deal→ |
| `products` | name, sku, type, price, currency, active |
| `deal_items` | deal→, product→, qty, unit_price |
| `goals` | metric, target, current, period, notes, owner→ |
| `tags` | label, color |
| `email_log` | subject, sender, received, direction, thread_id |
| `reports` | title, content, type, status, session_id |

**Vistas SQL (read-only):**
- `seg_hot_leads` — deals en propuesta/negociación
- `seg_pipeline_at_risk` — deals con fecha de cierre vencida
- `seg_cold_contacts` — contactos sin contacto en 30+ días con deals abiertos
- `seg_revenue_by_source` — revenue agrupado por canal de adquisición
- `seg_won_by_owner` — deals ganados agrupados por responsable

---

## Configuración MCP para Hermes

Ver [`hermes-config/README.md`](hermes-config/README.md) para la guía completa.

Snippet rápido (agregar a `~/.hermes/config.yaml`):

```yaml
mcp_servers:
  crm:
    command: npx
    args: ["-y", "@feirelles/pocketbase-mcp@2.0.0"]
    env:
      PB_URL: "http://localhost:8090"        # o http://pb-{tenant}:8090 en Docker
      PB_EMAIL: "hermes@crm.internal"        # email válido (no hermes@internal)
      PB_PASSWORD: "${PB_HERMES_PASSWORD}"
```

**Init requerido** al inicio de cada sesión de Hermes:
```
pocketbase_connect(name="crm", url="http://localhost:8090")
pocketbase_auth_admin(email="hermes@crm.internal", password=PB_PASSWORD, instance="crm")
```

---

## Documentación adicional

| Documento | Contenido |
|---|---|
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Historial completo de lo construido |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Guía de despliegue paso a paso |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Sistema visual (colores, tipografía, componentes) |
| [`docs/FEATURE_IMPLEMENTATION.md`](docs/FEATURE_IMPLEMENTATION.md) | Patrones de PocketBase API para cada feature |
| [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md) | Bugs documentados y roadmap |
| [`MULTI_TENANT_SECURITY.md`](MULTI_TENANT_SECURITY.md) | Aislamiento en despliegues con múltiples instancias |
| [`hermes-config/README.md`](hermes-config/README.md) | Configuración MCP + known issues de compatibilidad |
