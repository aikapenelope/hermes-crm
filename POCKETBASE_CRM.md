# PocketBase CRM

Lightweight CRM built on PocketBase + React PWA. Runs as a single Docker container
alongside the qyne-v1 stack, accessible via Tailscale on port 8090.

## Why PocketBase for this CRM

| | Twenty CRM | Directus | **PocketBase CRM** |
|---|---|---|---|
| RAM idle | ~1 GB | ~500 MB | **~40 MB** |
| Image size | ~1 GB | ~2 GB | **~40 MB** |
| DB | PostgreSQL | PostgreSQL | **SQLite (embedded)** |
| Containers | 2 | 1 | **1** |
| AI-controllable | Via REST | Via REST | **REST + MCP nativo** |
| Extensible | Limited | Via plugins | **JS migrations + View collections** |

## Architecture

```
Container: qyne-pocketbase
├── /pocketbase           ← Go binary v0.38.x (~12 MB)
├── /pb_public/           ← React PWA compiled (served at /)
│   ├── index.html
│   ├── manifest.json     ← installable as PWA
│   └── sw.js             ← Workbox service worker
└── /pb_data/             ← VOLUME: SQLite + uploads
    ├── data.db           ← database
    ├── storage/          ← uploaded files
    └── logs/             ← request logs (1-day retention)

Ports: 8090
Tailscale: 100.120.80.93:8090
Admin UI: /_/
REST API: /api/
```

## Directory structure

```
services/pocketbase/
├── Dockerfile             ← multi-stage: 1) build PWA, 2) pocketbase + pb_public
├── pb_migrations/
│   └── 1_init_crm.js      ← full CRM schema (auto-applied on first start)
└── ui/                    ← React + Vite PWA source
    ├── public/
    │   ├── manifest.json
    │   └── icons/
    └── src/
        ├── lib/
        │   ├── pb.ts      ← PocketBase client singleton
        │   └── types.ts   ← TypeScript types for all collections
        ├── hooks/
        │   └── index.ts   ← TanStack Query hooks (useContacts, useDeals, etc.)
        ├── components/
        │   ├── layout/    ← Sidebar, Topbar
        │   ├── ui/        ← Button, Badge, Input, Modal, etc.
        │   ├── KanbanBoard.tsx
        │   └── CalendarView.tsx
        └── pages/
            ├── LoginPage.tsx
            ├── DashboardPage.tsx
            ├── contacts/
            ├── companies/
            ├── deals/         ← includes Kanban board
            ├── tasks/
            ├── calendar/
            ├── products/
            ├── goals/
            └── segments/
```

## CRM Collections (schema)

All collections are defined in `pb_migrations/1_init_crm.js` and applied automatically
on first container start. To add fields or collections later, create `2_<name>.js`.

### Base collections

| Collection | Purpose | Key fields |
|---|---|---|
| `contacts` | People in the CRM | name, email, phone, company→, status, source, tags→ |
| `companies` | Organizations | name, industry, website, city, country, size |
| `deals` | Sales opportunities | title, value, stage, contact→, pipeline→, expected_close |
| `pipelines` | Kanban board definitions | name, stages (JSON), is_default |
| `tasks` | Actionable items | title, type, status, priority, due_date, contact→, deal→ |
| `activities` | Immutable event log | type, description, contact→, deal→, created_by→ |
| `notes` | Free-text notes | content, contact→, deal→, pinned |
| `tags` | Reusable labels | label, color |
| `products` | Product/service catalog | name, sku, type, price, currency, active |
| `deal_items` | Line items per deal | deal→, product→, qty, unit_price |
| `goals` | Sales targets | metric, target, period, owner→, currency |

### View collections (segments — read-only, always live)

| View | SQL summary |
|---|---|
| `seg_hot_leads` | deals in proposal/negotiation with their contacts |
| `seg_pipeline_at_risk` | deals past expected_close not yet won/lost |
| `seg_cold_contacts` | contacts not touched in >30 days with open deals |
| `seg_revenue_by_source` | SUM(deal.value) grouped by contact.source |
| `seg_won_by_owner` | won deals value grouped by owner |

### Hermes MCP integration

> **Updated:** The recommended package is `gaspechak-pocketbase-mcp@2.0.1` (May 2026).
> The previously documented `pocketbase-mcp-server` package has different environment
> variable names and is no longer maintained. See `hermes-config/` for full docs.

Add to the tenant's `config.yaml` (e.g. `/var/lib/martes/tenants/t001/config.yaml`):

```yaml
mcp_servers:
  crm:
    command: npx
    args: ["-y", "gaspechak-pocketbase-mcp@2.0.1"]
    env:
      PB_URL: "http://pb-t001:8090"        # Docker DNS — replace t001 with tenant code
      PB_EMAIL: "hermes@internal"           # standardized superuser email
      PB_PASSWORD: "${PB_HERMES_PASSWORD}"  # from tenant .env
    timeout: 60
    connect_timeout: 30
```

See [`hermes-config/README.md`](hermes-config/README.md) for:
- Full setup instructions (sidecar container, .env, SOUL.md snippet)
- Package comparison table and rationale
- Security model explanation
- Available tools reference (16 tools)

Hermes can then: query contacts, create deals, update task status, read segments,
manage collections — all via natural language.

## Migrations workflow

```bash
# First start — migrations run automatically
docker compose up pocketbase

# Add a new field to contacts
cat > services/pocketbase/pb_migrations/2_contacts_add_linkedin.js << 'EOF'
migrate((app) => {
  const col = app.findCollectionByNameOrId("contacts");
  col.fields.addField(new Field({ name: "linkedin", type: "url" }));
  app.save(col);
}, (app) => {
  const col = app.findCollectionByNameOrId("contacts");
  col.fields.removeByName("linkedin");
  app.save(col);
});
EOF

docker compose restart pocketbase
# Migration applies automatically on startup
```

## Tailscale access

```bash
# On the server (run once, or add to /etc/rc.local)
nohup socat TCP-LISTEN:8090,bind=100.120.80.93,fork TCP:127.0.0.1:8090 &
```

Then access from Tailscale network:
- PWA (CRM): `http://100.120.80.93:8090/`
- Admin panel: `http://100.120.80.93:8090/_/`

## Environment variables

| Variable | Description |
|---|---|
| `PB_SUPERUSER_EMAIL` | Admin email for first superuser |
| `PB_SUPERUSER_PASSWORD` | Admin password (keep secret) |
| `PB_ENCRYPTION_KEY` | Optional: encrypt pb_data at rest (32-char string) |

## PWA installation

From Chrome/Safari on Tailscale:
1. Open `http://100.120.80.93:8090/`
2. Browser shows "Add to Home Screen" prompt
3. Installs as standalone app with offline support

Offline mode: The service worker (Workbox) caches the app shell and last-fetched
data. Create/update operations queue locally and sync when back online.
