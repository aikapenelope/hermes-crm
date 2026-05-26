# Hermes CRM — MCP Configuration for Hermes Agent

This directory contains configuration snippets and documentation for connecting
a Hermes Agent instance to the PocketBase CRM via MCP.

---

## MCP Server: `gaspechak-pocketbase-mcp`

The recommended MCP server is [`gaspechak-pocketbase-mcp`](https://www.npmjs.com/package/gaspechak-pocketbase-mcp)
(v2.0.1+, published May 2026).

### Why this package over alternatives

| Package | Version | Reason |
|---|---|---|
| `gaspechak-pocketbase-mcp` | 2.0.1 (May 2026) | **Recommended** — token-efficient, schema-aware MCP Resources, single-instance focus |
| `@feirelles/pocketbase-mcp` | 2.0.0 | 26 tools, TOML output — better for multi-instance use cases |
| `pocketbase-mcp` (mabeldata) | 1.0.2 (Oct 2025) | Includes migrations management, but outdated |
| `dynamic-pocketbase-mcp` | 2.1.2 | Runtime schema discovery — use when schema changes frequently |
| `pocketbase-cursor-mcp` | — | IDE-focused, not for gateway agents |

**Token efficiency is critical** for Hermes running on OpenRouter/gpt-4o-mini.
`gaspechak-pocketbase-mcp` has token-efficient defaults: `perPage=10`,
`skipTotal=true`, field excerpts at 200 chars. Filter syntax, field types, and
API rules are exposed as **MCP Resources** (not tool descriptions), so they
don't inflate the tool description token count on every message.

### Tools available (16 total)

| Tool | Description |
|---|---|
| `pb_health` | Check PocketBase server health |
| `pb_schema` | Get schema for one or all collections |
| `pb_auth_superuser` | Authenticate as superuser |
| `pb_auth_user` | Authenticate as regular user |
| `pb_collection_create` | Create a new collection |
| `pb_collection_patch` | Update a collection schema |
| `pb_collection_delete` | Delete a collection |
| `pb_record_list` | List/filter/paginate records |
| `pb_record_get` | Get a single record by ID |
| `pb_record_mutate` | Create, update, or delete a record |
| `pb_backup` | Create or list backups |
| `pb_logs` | Access request logs |
| `pb_settings` | Read/update app settings |
| `pb_rules_test` | Test API rule expressions |
| `pb_file_url` | Build file download URLs |
| `pb_help` | Get usage help |

---

## Installation in a Hermes tenant

### 1. Add to `config.yaml`

Add the following block to the tenant's config file at
`/var/lib/martes/tenants/{code}/config.yaml` (or equivalent `~/.hermes/config.yaml`):

```yaml
mcp_servers:
  crm:
    command: npx
    args: ["-y", "gaspechak-pocketbase-mcp@2.0.1"]
    env:
      PB_URL: "http://pb-{tenant_code}:8090"   # Docker DNS — replace {tenant_code}
      PB_EMAIL: "hermes@crm.internal"           # ⚠️ must be valid email (no hermes@internal)
      PB_PASSWORD: "${PB_HERMES_PASSWORD}"      # injected from tenant .env
    timeout: 60          # per-tool timeout in seconds
    connect_timeout: 30  # initial connection timeout
```

**`PB_URL` note:** In the Martes multi-tenant architecture, the PocketBase container
is named `pb-{tenant_code}` (e.g. `pb-t001`). Hermes reaches it via Docker DNS at
`http://pb-t001:8090` — **this never traverses the internet**. The MCP server runs
inside the Hermes container, which is on the same Docker bridge network (`tenant-t001-net`)
as the PocketBase container.

### 2. Add credentials to `.env`

The tenant's `.env` file at `/var/lib/martes/tenants/{code}/.env` must include:

```env
PB_HERMES_PASSWORD=<generated-secret>
```

Generate a strong password:
```bash
openssl rand -hex 32
```

### 3. Verify PocketBase is running

Before restarting Hermes, confirm the PocketBase sidecar is up:
```bash
docker exec pb-t001 /pb/pocketbase --version
curl -s http://pb-t001:8090/api/health  # from inside the Docker network
```

### 4. Restart Hermes

```bash
docker restart hermes-t001
```

The MCP server starts lazily on first tool call. Verify with:
```bash
docker logs hermes-t001 2>&1 | grep -i "mcp\|crm\|pocketbase"
```

---

## Security model

The MCP connection is **internal-only**:

```
hermes-t001 container
  └─ npx gaspechak-pocketbase-mcp
       └─ HTTP → http://pb-t001:8090/api/  (Docker DNS, same bridge network)

Public internet
  └─ HTTPS → t001.app.martes.app → Traefik → pb-t001:8090  (UI only)
```

The superuser credentials (`PB_EMAIL` / `PB_PASSWORD`) are:
- Stored only in the tenant `.env` file (mode 0600, root-only readable)
- Never exposed to the internet
- Used only by the MCP server running inside the Hermes container
- The PocketBase port 8090 is NOT published to the host; it is only reachable via
  the `tenant-t001-net` Docker bridge network

Using a standardized email (`hermes@crm.internal`) across all tenants is safe because:
1. PocketBase is isolated per-tenant (separate container, separate SQLite database)
2. The MCP connection never leaves the Docker network
3. Even if credentials were compromised, the attacker would need Docker network access

---

## Known issues & workarounds

### `pb_record_list` returns 400 — "Something went wrong"

**Root cause:** PocketBase v0.22+ no longer adds `created`/`updated` as automatic
system columns to user-created collections. Migrations 1–4 never declared them
explicitly. Without those SQLite columns, any `sort=-created` query (which
`gaspechak-pocketbase-mcp` issues by default) fails at the database level.

**Status:** Fixed in migration 5 (`5_add_autodate_fields.js`).

If you deployed before migration 5 was available (fresh install from an older
image), run `docker compose restart crm` — migration 5 applies automatically.

For existing deployments that already have data, migration 5 is safe to apply:
it only adds missing columns and is fully idempotent.

---

### gaspechak-pocketbase-mcp gets 403 when Hermes is in Docker

**Root cause:** `PB_ADMIN_IPS` restricts both the admin panel **and** the superuser
auth API. When Hermes runs as a Docker container, its requests arrive from the
Docker bridge network (`172.17.x.x`), not from `127.0.0.1`. If `172.16.0.0/12`
is not in `PB_ADMIN_IPS`, every `gaspechak-pocketbase-mcp` auth attempt returns
`HTTP 403 You are not allowed to perform this request`.

**Status:** Fixed — default `PB_ADMIN_IPS` now includes `172.16.0.0/12`.
See `.env.example` for the recommended value per deployment scenario.

---

### `pb_schema` and `pb_health` return "Invalid structured content"

**Root cause:** `gaspechak-pocketbase-mcp@2.0.1` uses MCP TypeScript SDK v1.29,
which returns structured content objects. Hermes v0.14.x Python MCP SDK v1.26
validates tool outputs with `additionalProperties: False` and rejects any
response containing extra JSON fields.

**Impact:** Only `pb_schema` and `pb_health` tools fail. All CRUD operations
(`pb_record_list`, `pb_record_mutate`, `pb_record_get`) work correctly.

**Workaround:** No action needed for core CRM usage. Monitor for a Hermes SDK
update that relaxes the structured content validation.

---

## SOUL.md snippet for CRM awareness

Add to the tenant's `SOUL.md` to make Hermes CRM-aware out of the box:

```markdown
## CRM Access

You have access to a PocketBase CRM via the `crm` MCP server.

Key collections:
- `contacts` — People: name, email, phone, status (lead/prospect/customer), source
- `companies` — Organizations linked to contacts
- `deals` — Sales opportunities with pipeline stages (lead→qualified→proposal→negotiation→won/lost)
- `tasks` — Actionable items linked to contacts/deals
- `notes` — Free-text notes on contacts/deals
- `activities` — Immutable event log (append-only)
- `conversations` — Message log (written automatically by post-hook, do not create manually)

Use `pb_schema` to inspect any collection's fields before querying.
Use `pb_record_list` to fetch data with filters.
Use `pb_record_mutate` to create/update records.

When a client mentions a person, company, or business deal, always check if
they exist in the CRM first (pb_record_list with a name filter) before creating
duplicates.
```
