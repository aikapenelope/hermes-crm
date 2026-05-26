# Hermes Hooks — PocketBase CRM

Hooks are loaded from `~/.hermes/hooks/` (or the tenant volume at
`/var/lib/martes/tenants/{code}/hooks/`). Each subdirectory is one hook.

## Available hooks

### `pocketbase-crm`

**What it does:** Logs every Hermes conversation turn to the PocketBase CRM
`conversations` collection after the response is sent to the user.

- Fires on `agent:end` — after Hermes has already replied, zero blocking
- Zero tokens — no LLM involvement, pure Python HTTP calls
- Attempts to link conversations to Contact records (WhatsApp only, by phone)
- Never raises — errors are swallowed so Hermes is never affected

**Required env vars in the tenant `.env`:**

```env
POCKETBASE_URL=http://pb-t001:8090
PB_HERMES_PASSWORD=<openssl rand -hex 32>
```

Optional:
```env
PB_HERMES_EMAIL=hermes@internal   # default if not set
```

**How to install in a Martes tenant:**

```bash
# On the Martes server
TENANT=t001
HOOKS_DIR=/var/lib/martes/tenants/${TENANT}/hooks

# Create the hooks directory if it doesn't exist
mkdir -p "${HOOKS_DIR}/pocketbase-crm"

# Copy files from this repo
# (or clone the repo and copy)
cp hooks/pocketbase-crm/HOOK.yaml  "${HOOKS_DIR}/pocketbase-crm/"
cp hooks/pocketbase-crm/handler.py "${HOOKS_DIR}/pocketbase-crm/"

# Add env vars to the tenant .env
echo "POCKETBASE_URL=http://pb-${TENANT}:8090"      >> /var/lib/martes/tenants/${TENANT}/.env
echo "PB_HERMES_PASSWORD=$(openssl rand -hex 32)"   >> /var/lib/martes/tenants/${TENANT}/.env

# Restart Hermes to pick up the hook
docker restart hermes-${TENANT}

# Verify the hook was loaded
docker logs hermes-${TENANT} 2>&1 | grep "pocketbase-crm"
# Expected: [hooks] Loaded hook 'pocketbase-crm' for events: ['agent:end']
```

**How to verify it's logging:**

```bash
# Send a Telegram message to the bot, then:
curl -s "http://pb-t001:8090/api/collections/conversations/records" \
  -H "Authorization: Bearer $(cat /var/lib/martes/tenants/t001/.env | grep PB_HERMES | cut -d= -f2)" \
  | python3 -m json.tool | head -40
```

**Debugging:**

```bash
docker logs hermes-t001 2>&1 | grep "pocketbase-crm"
```

Log level for the hook is DEBUG — set `HERMES_LOG_LEVEL=DEBUG` in `.env` to see
all hook activity including authentication, contact lookup, and record creation.

---

## Hermes hook system reference

From `hermes-agent/gateway/hooks.py`:

```
~/.hermes/hooks/
  my-hook/
    HOOK.yaml      # required: name, description, events
    handler.py     # required: async def handle(event_type, context)
```

**Available events:**

| Event | When | Context keys |
|---|---|---|
| `gateway:startup` | Gateway process starts | `{}` |
| `session:start` | First message of a new session | `platform, user_id, session_id, session_key` |
| `session:end` | `/new` or `/reset` ran | `platform, user_id, session_id` |
| `agent:start` | Agent begins processing | `platform, user_id, chat_id, session_id, message` |
| `agent:end` | Agent finishes, response sent | `platform, user_id, chat_id, session_id, message, response` |
| `command:*` | Any slash command executed | `platform, user_id, command, args` |

Errors in hooks are caught by Hermes and logged but **never block the pipeline**.
