# Hermes CRM — Handoff Mayo 2026

Estado completo del proyecto para continuar el trabajo.
Última actualización: mayo 2026.

---

## Estado actual del repo

**Rama principal:** `main` — d8557bc
**PRs mergeados:** #1–#14 (excepto #9 cerrado como superseded por #10)
**PR abierto:** #15 — MERGEABLE, sin conflictos, crítico

### Historial de PRs en orden

| # | Estado | Contenido |
|---|---|---|
| #1 | ✅ merged | POCKETBASE_CRM.md — spec inicial |
| #2 | ✅ merged | hermes-crm completo (PocketBase + SvelteKit SPA) |
| #3 | ✅ merged | CRUD completo UI — product-grade CRM |
| #4 | ✅ merged | Diseño brutalist monochrome — design system |
| #5 | ✅ merged | Security: fix filter injection + server-side token validation |
| #6 | ✅ merged | MCP config + docs hermes-config |
| #7 | ✅ merged | Hermes conversation logging hook (luego removido en #10) |
| #8 | ✅ merged | Fix seg_revenue_by_source SQL (CASE WHEN) |
| #9 | ❌ closed | Superseded por #10 |
| #10 | ✅ merged | Remove conversations — CRM solo datos estructurados |
| #11 | ✅ merged | Tenant auth setup — seed CRM user, lock registration, settings page |
| #12 | ✅ merged | Email log + reports — Gmail sync skill + páginas CRM |
| #13 | ✅ merged | Production-ready deploy — GitHub Action, Dockerfile hardening, standalone compose |
| #14 | ✅ merged | Calendar, goals + drag-and-drop kanban — UI brutalist completa |
| **#15** | **🔴 OPEN — MERGEABLE** | **Sprint 1+2: timeline, search global, realtime, company detail, forecast, migrations críticas** |

---

## PR #15 — Mergear inmediatamente

**Por qué es urgente:** contiene fixes críticos descubiertos en el deploy real.

### Bug 1: AutodateField ausente (Migration 5) — CRÍTICO

**Causa raíz:**
```
PocketBase v0.22+ NO auto-crea las columnas 'created' y 'updated'
en base collections creadas con app.save().
Las migrations 1-4 nunca las declararon explícitamente.
→ TODAS las colecciones CRM estaban sin columnas created/updated.
→ Cualquier sort por created/updated → HTTP 400.
→ gaspechak-pocketbase-mcp hardcodea sort=-created → TODO falla.
→ Hermes MCP completamente inaccesible.
```

**Fix:** `pb_migrations/5_add_autodate_fields.js` — añade `AutodateField`
a los 13 colecciones del CRM. Idempotente (try/catch si ya existe).

### Bug 2: logs.db owned by root — entrypoint.sh

**Síntoma:** cero request logs, logging silenciosamente roto.
**Fix en PR #15:** `touch "${DATA_DIR}/logs.db"` antes de arrancar PocketBase.
**Fix permanente en PR #13:** el Dockerfile ahora corre como usuario `pocketbase`
uid=1001, entonces los archivos se crean con el owner correcto.

### Cambio de MCP: gaspechak → @feirelles/pocketbase-mcp

**El cambio:**

```yaml
# ANTES (no funcionaba — fallaba HTTP 400 + hardcodea sort=-created):
mcp_servers:
  crm:
    command: npx
    args: ["-y", "gaspechak-pocketbase-mcp@2.0.1"]
    env:
      PB_URL: "http://pb-t001:8090"
      PB_EMAIL: "hermes@internal"
      PB_PASSWORD: "${PB_HERMES_PASSWORD}"

# DESPUÉS (funciona — testeado en producción live):
mcp_servers:
  crm:
    command: npx
    args: ["-y", "@feirelles/pocketbase-mcp@2.0.0"]
    env:
      PB_URL: "http://pb-t001:8090"
      PB_EMAIL: "hermes@crm.internal"    # <-- email cambió
      PB_PASSWORD: "${PB_HERMES_PASSWORD}"
```

**Por qué `@feirelles` funciona:**
- No hardcodea `sort=-created` → no falla cuando el AutodateField no existe
- 26 herramientas vs 16 de gaspechak
- Multi-instance runtime: `pocketbase_connect("nombre", "url")` en caliente
- Output TOML: ~25% menos tokens que JSON
- Incluye backup management, bulk operations, file upload

**Documentado en:** `MULTI_TENANT_SECURITY.md` (viene en PR #15)

### Migraciones en PR #15

| Migration | Contenido | ¿Crítica? |
|---|---|---|
| `5_add_autodate_fields.js` | AutodateField a 13 colecciones | **SÍ — sin esto el MCP falla** |
| `6_activities_add_date_title.js` | date + title a activities (necesario para calendar) | Sí |
| `7_notes_add_attachments.js` | FileField a notes (5×5MB, imagen/pdf/texto) | No |
| `8_schema_improvements.js` | contacts: city/country/birthday/whatsapp; goals: current/notes | No |

### Páginas nuevas en PR #15 (testeadas)

- `GlobalSearch.svelte` — header search funcional (contacts, companies, deals, tasks)
- `/companies/[id]` — detalle de empresa con contactos, deals, revenue stats
- `/contacts/import` — importación CSV de contactos
- `/deals/forecast` — forecast agrupado por expected_close mensual

---

## Stack actual

| Capa | Tecnología | Versión |
|---|---|---|
| Backend | PocketBase | 0.38.2 |
| Frontend | SvelteKit | 2.61.1 |
| UI runtime | Svelte | 5.55.9 |
| CSS | Tailwind CSS | 4.3.0 |
| TypeScript | TypeScript | 5.8.3 |
| Container | Docker Alpine | multi-arch amd64/arm64 |
| Registry | ghcr.io/aikapenelope/hermes-crm | auto-build en push a main |
| MCP | @feirelles/pocketbase-mcp | 2.0.0 |

## Diseño UI

**Brutalist monochrome:**
- Background: `#070707`
- Border: `#1a1a1a` (cards), `#111` (hover)
- Text primario: `#ffffff`
- Text secundario: `#888`
- Text muted: `#444` / `#555`
- Font: `font-mono`, `uppercase`, `tracking-widest`
- Accent: rainbow gradient `#ff3333 → #ffaa00 → #00ffaa → #00aaff → #aa00ff`
- Sin border-radius en cards (brutalismo puro)
- Números de sección (cuadros blancos `[N]`) en cards

---

## Infraestructura Martes (producción)

**Servidor:** Hetzner CX43, IP `204.168.169.254`
**Orquestador:** Coolify
**Reverse proxy:** Traefik (certresolver letsencrypt)
**DNS wildcard:** `*.app.martes.app → 204.168.169.254` — PENDIENTE configurar en registrador

### Arquitectura de red

```
Internet → Traefik (red: coolify)
               ├── api.martes.app → meta-agent:7777
               └── t001.app.martes.app → pb-t001:8090

Docker networks:
  coolify             → Traefik descubre containers con labels
  tenant-t001-net     → red aislada por tenant (solo hermes + pb)
  
Containers por tenant:
  hermes-t001   → solo tenant-t001-net
  pb-t001       → tenant-t001-net + coolify (doble red)
```

### Volúmenes del CRM por tenant

```
/var/lib/martes/tenants/t001/
├── pb_data/        ← SQLite del CRM (contacts, deals, tasks, notes…)
├── config.yaml     ← configuración Hermes del tenant (incluye MCP crm)
└── SOUL.md         ← personalidad/instrucciones de Hermes para ese tenant
```

`pb_data/` es el único volumen crítico del CRM. Si se pierde, se pierden todos
los datos del tenant. Se debe hacer backup diario (ver sección backups).

---

## Próximos pasos

### 1. Merge PR #15 (inmediato)

```bash
gh pr merge 15 --merge --repo aikapenelope/hermes-crm
```

El GitHub Action publicará la imagen automáticamente.

### 2. DNS wildcard (una vez, en el registrador)

```
*.app.martes.app  →  A  →  204.168.169.254
```

Desbloquea acceso externo a los tenants CRM.

### 3. WhatsApp conversations (nuevo feature — ver plan abajo)

---

## Feature WhatsApp — Plan de implementación

### Análisis de Kapso (investigado mayo 2026)

**Lo que Kapso NO tiene:** exportación CSV nativa — no existe en la documentación.

**Lo que Kapso SÍ tiene (vía API + `@kapso/whatsapp-cloud-api` SDK):**

```typescript
// Listar conversaciones
await client.conversations.list({
  status: "active",
  lastActiveSince: "2026-01-01T00:00:00Z",
})
// → { id, phoneNumber, status, lastActiveAt, metadata }

// Mensajes de una conversación
await client.messages.list({ conversationId: "conv-123" })
// → { id, type, direction, content, timestamp, from, to,
//     kapso.content, kapso.has_media, kapso.media_url,
//     kapso.contact_name }
```

**Campos disponibles por mensaje:**
- `id` — WAMID de WhatsApp
- `type` — text | image | video | audio | document | location | interactive | template | reaction
- `direction` — inbound | outbound
- `content` — texto del mensaje
- `timestamp` — Unix segundos
- `from` / `to` — números E.164
- `kapso.contact_name` — nombre del contacto si existe
- `kapso.has_media` + `kapso.media_url` — adjuntos

### ¿Es buena idea?

**Sí, por tres razones sólidas:**

1. **WhatsApp es el canal principal en LATAM** — donde están los clientes de los
   tenants de Martes. El historial de conversaciones es el activo más valioso.

2. **El patrón ya existe** — tenemos `email_log` con el mismo approach: Hermes
   sync periódico → PocketBase → página read-only en el CRM. Es copiar el patrón.

3. **Hermes puede consultar el historial** — con las conversaciones en PocketBase,
   Hermes puede responder "¿qué le dije a Juan la semana pasada?" y recuperar
   contexto antes de contactar de nuevo.

### Arquitectura propuesta (tres capas)

```
Kapso API
    │
    ▼ Script Python (cron job Hermes, cada hora)
    │ GET /v1/conversations → GET /v1/messages por conv
    │ Deduplicación por WAMID (id del mensaje)
    ▼
PocketBase
    ├── whatsapp_conversations (una fila por conversación)
    │     id, phone_number, contact_name, status, last_active_at,
    │     messages_count, contact (relation → contacts, nullable)
    │
    └── whatsapp_messages (una fila por mensaje)
          id, wamid, conversation (relation), direction, type,
          content, timestamp, contact_name, has_media, media_url
    │
    ▼
CRM /whatsapp (página read-only)
    ├── Lista de conversaciones (filtrable por contacto/fecha/estado)
    └── Detalle de conversación (mensajes cronológicos, estilo WhatsApp)
```

### Colecciones PocketBase

```javascript
// whatsapp_conversations
{
  phone_number:   TextField (required),
  contact_name:   TextField,
  status:         SelectField (active, ended),
  last_active_at: DateField,
  messages_count: NumberField,
  conv_id:        TextField (Kapso ID, for deduplication),
  contact:        RelationField → contacts (nullable, match by phone)
}

// whatsapp_messages
{
  wamid:        TextField (Kapso/WhatsApp message ID, unique),
  conversation: RelationField → whatsapp_conversations (required),
  direction:    SelectField (inbound, outbound),
  type:         SelectField (text, image, video, audio, document, location, template, reaction),
  content:      TextField (text content),
  timestamp:    DateField (required),
  has_media:    BoolField,
  media_url:    TextField,
  contact_name: TextField
}
```

### Reglas de acceso

```javascript
// Solo lectura desde la UI — Hermes escribe
createRule: AUTH,    // Hermes (superuser) escribe
updateRule: null,    // inmutable — historial no se edita
deleteRule: null,    // permanente
listRule:   AUTH,    // el dueño del negocio puede ver
viewRule:   AUTH
```

### Skill de Hermes: crm-whatsapp-sync

Patrón idéntico a `hermes-config/skills/crm-gmail-sync/`:

```
hermes-config/skills/crm-whatsapp-sync/
├── SKILL.md           ← instrucciones para Hermes (activar, desactivar, sync manual)
└── scripts/
    └── sync_whatsapp_to_crm.py   ← script Python stdlib
```

Variables de entorno requeridas (en tenant .env):

```env
KAPSO_API_KEY=<clave de la cuenta Kapso>
KAPSO_PHONE_NUMBER_ID=<ID del número de WhatsApp en Kapso>
POCKETBASE_URL=http://pb-t001:8090    # o http://crm:8090 en standalone
PB_HERMES_PASSWORD=<misma contraseña del superuser>
```

El script:
1. Autentica con PocketBase (superuser, igual que Gmail sync)
2. Llama a `GET https://app.kapso.ai/api/platform/v1/conversations`
3. Para cada conversación nueva/activa: `GET /messages?conversationId=X`
4. Deduplica por `wamid` antes de insertar
5. Log: `N conversaciones, M mensajes nuevos, P skipped`

Activación: el usuario le dice a Hermes por Telegram:
> "activa el sync de WhatsApp al CRM"

Hermes sigue el `SKILL.md` y crea el cron job automáticamente.

### UI de la página /whatsapp (diseño brutalist)

```
WHATSAPP // CONVERSATIONS

[Buscador por contacto/número]   [Filtro: active/ended]

┌─ Vista dos paneles (desktop) ────────────────────────────────┐
│  CONVERSACIONES              │  MENSAJES                      │
│  ─────────────────────────── │  ─────────────────────────── │
│  • Juan Pérez                │  11:30am HOY                  │
│    +57 300 123 4567          │  ← Hola, me interesa el plan  │
│    hace 2h · 14 msg          │                               │
│                              │  11:32am                      │
│  • Ana Gómez                 │  → Claro, te cuento...        │
│    +57 321 987 6543          │                               │
│    hace 5h · 8 msg           │  ← Perfecto, ¿precio?        │
│                              │                               │
│  ...                         │  → [imagen]                   │
└──────────────────────────────┴───────────────────────────────┘

Inbound (←) en la izquierda, outbound (→) en la derecha.
Misma convención visual que WhatsApp pero en mono-dark.
```

### Diferencias con el email log

| Aspecto | Email log | WhatsApp conversations |
|---|---|---|
| Estructura | Un mensaje = una fila | Conversación + N mensajes anidados |
| UI | Lista simple | Dos paneles (conv list + thread) |
| Media | No | Sí (has_media, media_url) |
| Dirección | inbound/outbound | inbound/outbound |
| Dedup key | thread_id | wamid |

### Plan de implementación en 4 PRs

| PR | Contenido | Prerequisito |
|---|---|---|
| A | Migration 9: whatsapp_conversations + whatsapp_messages | PR #15 mergeado |
| B | Página /whatsapp (UI: list + thread view) | PR A |
| C | Skill crm-whatsapp-sync (SKILL.md + sync_whatsapp_to_crm.py) | PR A |
| D | Contact matching: link conversaciones con contactos por phone_number | PR A+B |

PR D es opcional — la feature funciona sin contact linking. Las conversaciones
quedan como archivo independiente buscable, y si el número coincide con un
contacto del CRM se linkea automáticamente.

### Cómo arrancar

1. Mergear PR #15
2. Que el tenant configure `KAPSO_API_KEY` en su `.env`
3. Ejecutar el PR A (migration + skill)
4. El usuario le dice a Hermes: "activa el sync de WhatsApp al CRM"
5. Hermes instala el skill, crea el cron job
6. Las conversaciones empiezan a aparecer en `/whatsapp`

---

## Archivos de referencia

| Archivo | Contenido |
|---|---|
| `MULTI_TENANT_SECURITY.md` | Modelo de seguridad + config MCP correcta |
| `docs/KNOWN_ISSUES.md` | Issues conocidos y sus fixes |
| `docs/FEATURE_IMPLEMENTATION.md` | Referencia API PocketBase |
| `docs/DESIGN_SYSTEM.md` | Design system brutalist |
| `hermes-config/mcp-snippet.yaml` | Config MCP feirelles para copiar |
| `hermes-config/skills/crm-gmail-sync/` | Patrón de sync skill (base para WhatsApp) |
| `.env.example` | Todas las variables de entorno documentadas |
| `docker-compose.yml` | Standalone deployment (cualquier VPS) |
