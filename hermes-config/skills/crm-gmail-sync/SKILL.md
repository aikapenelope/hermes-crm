---
name: crm-gmail-sync
description: "Sync Gmail inbox to Hermes CRM: saves email subjects and senders to the email_log collection automatically via cron."
version: 1.0.0
author: AikaLabs
license: MIT
platforms: [linux, macos]
metadata:
  hermes:
    tags: [Gmail, CRM, PocketBase, Email, Cron, Sync]
    related_skills: [google-workspace]
---

# CRM Gmail Sync

Reads recent Gmail messages (subject + sender only — no body) and writes
them to the PocketBase `email_log` collection via the REST API.
Designed to run as a Hermes cron job so the CRM email feed stays current
without manual intervention.

## Prerequisites

1. **google-workspace skill must be configured** — the sync script uses the
   `google_api.py` CLI from that skill to authenticate with Gmail.
   If not set up yet, run `$GSETUP --check` and follow its instructions first.

2. **CRM MCP must be running** — PocketBase sidecar (`pb-{tenant_code}`)
   must be active and the `crm` MCP server configured in `config.yaml`.
   The script writes directly to the PocketBase REST API (not via MCP)
   so it works from within a cron job without Hermes overhead.

3. **Environment variables** in `~/.hermes/.env`:
   ```env
   POCKETBASE_URL=http://pb-t001:8090
   PB_HERMES_PASSWORD=<same password as in the tenant .env>
   ```

## Scripts

- `scripts/sync_gmail_to_crm.py` — main sync script; authenticate with
  Gmail, fetch recent messages, write to PocketBase `email_log`.

## Activation (user asks via Telegram/WhatsApp)

When the user says something like:
- "activa el sync de Gmail al CRM"
- "configura el cron de emails"
- "quiero ver mis emails en el CRM"

**Do the following steps:**

### Step 1 — Verify Google Workspace is configured
```bash
GSETUP="python ${HERMES_HOME:-$HOME/.hermes}/skills/productivity/google-workspace/scripts/setup.py"
$GSETUP --check
```
If output is NOT `AUTHENTICATED`, tell the user to set up Google Workspace
first and stop here.

### Step 2 — Verify PocketBase is reachable
```bash
curl -s "${POCKETBASE_URL:-http://localhost:8090}/api/health" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code', 'ERROR'))"
```
Expected output: `200`

### Step 3 — Run a manual sync to test
```bash
SKILL_DIR="${HERMES_HOME:-$HOME/.hermes}/skills/crm-gmail-sync"
python3 "$SKILL_DIR/scripts/sync_gmail_to_crm.py" --max 20 --days 3
```
If successful, tell the user how many emails were synced.

### Step 4 — Create the cron job
Ask the user: "¿Cada cuánto tiempo quieres sincronizar? (recomiendo cada hora)"

Then create the cron job in `~/.hermes/cron/` with the schedule they choose.
Use the `cronjob_tools` or write the cron file directly:

```python
import json, os
from pathlib import Path

cron_dir = Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes")) / "cron"
cron_dir.mkdir(exist_ok=True)

cron_entry = {
    "id":       "crm-gmail-sync",
    "schedule": "0 * * * *",   # every hour — adjust per user preference
    "prompt":   (
        "Run the Gmail CRM sync script to update the email log. "
        "Execute: python3 ~/.hermes/skills/crm-gmail-sync/scripts/sync_gmail_to_crm.py --max 50 --days 1 "
        "Report the number of new emails synced. If any errors occur, log them but do not retry."
    ),
    "enabled":  True,
}

cron_file = cron_dir / "crm-gmail-sync.json"
cron_file.write_text(json.dumps(cron_entry, indent=2))
print(f"Cron job created: {cron_file}")
```

Confirm to the user: "El cron job está activo. Sincronizaré tu Gmail al CRM cada hora."

## Manual sync (on-demand)

When the user asks "sync emails" or "actualiza el CRM con mis emails":

```bash
python3 "${HERMES_HOME:-$HOME/.hermes}/skills/crm-gmail-sync/scripts/sync_gmail_to_crm.py" --max 100 --days 7
```

## Cron job prompt (what Hermes runs automatically)

The cron job instructs Hermes to run the script and report back.
No LLM calls are made during the sync itself — the Python script handles
everything directly via Gmail API + PocketBase REST API.

## Deactivate

When the user says "desactiva el sync de Gmail" or "para el cron de emails":

```python
from pathlib import Path
import os
cron_file = Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes")) / "cron" / "crm-gmail-sync.json"
if cron_file.exists():
    cron_file.unlink()
    print("Cron job removed")
```

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `AUTHENTICATED` check fails | Google Workspace not set up | Run `$GSETUP` setup flow |
| `401` from PocketBase | Wrong `PB_HERMES_PASSWORD` | Check `.env` matches tenant deployment |
| `Connection refused` | PocketBase not running | Check `docker ps \| grep pb-t001` |
| `0 emails synced` | All recent emails already in DB | Normal — deduplication is working |
| Gmail API quota error | Too many requests | Increase cron interval to 2h |
