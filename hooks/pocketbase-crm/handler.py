"""
PocketBase CRM — Hermes conversation logging hook.

Fires on ``agent:end`` to append every inbound message and outbound response
to the PocketBase ``conversations`` collection.

Zero tokens, zero LLM involvement — this is pure Python executed after
Hermes has already delivered its reply to the user.

─────────────────────────────────────────────────────────────────────────────
Architecture
─────────────────────────────────────────────────────────────────────────────

  agent:end
       │
       ▼
  handle(event_type, context)
       │
       ├── authenticate() ──────────────────────────────────────────────────→ PocketBase
       │     POST /api/collections/_superusers/auth-with-password           ← token (cached)
       │
       ├── find_contact_by_phone() ─────────────────────────────────────────→ PocketBase
       │     GET /api/collections/contacts/records?filter=phone~'{user_id}' ← contact_id | None
       │
       ├── POST conversations (inbound message) ───────────────────────────→ PocketBase
       └── POST conversations (outbound response) ─────────────────────────→ PocketBase

The handler swallows ALL exceptions so Hermes is never blocked by CRM errors.

─────────────────────────────────────────────────────────────────────────────
Required environment variables (in the tenant .env)
─────────────────────────────────────────────────────────────────────────────

  POCKETBASE_URL       URL of the PocketBase sidecar
                       Example: http://pb-t001:8090
                       In the Martes architecture this is Docker DNS — the
                       PocketBase container is on the same bridge network.

  PB_HERMES_PASSWORD   Superuser password for hermes@internal.
                       Generate: openssl rand -hex 32

Optional:
  PB_HERMES_EMAIL      Override superuser email (default: hermes@internal)

─────────────────────────────────────────────────────────────────────────────
Contact resolution
─────────────────────────────────────────────────────────────────────────────

WhatsApp: user_id is the phone number (e.g. "584140000000").
          The handler attempts to find a Contact record where `phone`
          contains the last 10 digits of the user_id. Best-effort — if no
          match is found the conversation is logged without a contact link.

Telegram: user_id is a numeric string (e.g. "123456789").
          No automatic lookup — Telegram IDs are not phone numbers.
          Log without contact link; link manually from the CRM UI.

Other platforms: no automatic lookup. Log without contact link.

─────────────────────────────────────────────────────────────────────────────
Idempotency
─────────────────────────────────────────────────────────────────────────────

``agent:end`` fires exactly once per completed turn. The handler does not
de-duplicate: if the hook is called twice (e.g. due to a Hermes restart
mid-hook), two conversation records will be created. In practice this is
rare; the conversations collection is append-only by design and the UI
handles duplicate messages gracefully.

─────────────────────────────────────────────────────────────────────────────
Debugging
─────────────────────────────────────────────────────────────────────────────

  docker logs hermes-t001 2>&1 | grep 'pocketbase-crm'
"""

import asyncio
import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Optional

logger = logging.getLogger("hooks.pocketbase-crm")

# ─── Module-level token cache ─────────────────────────────────────────────────
# Token lives for the lifetime of the Hermes gateway process (~days).
# On expiry or 401 the next call will re-authenticate transparently.
_pb_token: Optional[str] = None
_pb_token_lock = asyncio.Lock()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _config() -> tuple[str, str, str]:
    """Return (pb_url, email, password) from environment, or empty strings."""
    pb_url   = os.environ.get("POCKETBASE_URL", "").rstrip("/")
    email    = os.environ.get("PB_HERMES_EMAIL", "hermes@internal")
    password = os.environ.get("PB_HERMES_PASSWORD", "")
    return pb_url, email, password


def _http_json(
    url: str,
    *,
    method: str = "GET",
    payload: Optional[dict] = None,
    token: Optional[str] = None,
    timeout: int = 8,
) -> Optional[dict]:
    """Synchronous JSON HTTP helper. Returns parsed dict or None on error."""
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    data: Optional[bytes] = json.dumps(payload).encode() if payload else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        logger.debug("[pocketbase-crm] HTTP %s %s → %d: %s", method, url, e.code, body[:200])
        return None
    except Exception as e:
        logger.debug("[pocketbase-crm] HTTP %s %s → %s", method, url, e)
        return None


async def _run_sync(fn: Any, *args: Any) -> Any:
    """Run a blocking function in the default thread pool."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, fn, *args)


# ─── Authentication ────────────────────────────────────────────────────────────

async def _get_token(pb_url: str, email: str, password: str) -> Optional[str]:
    """
    Return a valid superuser token, authenticating if needed.

    Uses a module-level cache: authenticates once per process and reuses the
    token. On 401 (expired or revoked token) the cache is cleared and a fresh
    auth attempt is made.
    """
    global _pb_token
    if _pb_token:
        return _pb_token

    async with _pb_token_lock:
        # Double-check after acquiring the lock.
        if _pb_token:
            return _pb_token

        logger.debug("[pocketbase-crm] authenticating as %s", email)
        result = await _run_sync(
            _http_json,
            f"{pb_url}/api/collections/_superusers/auth-with-password",
            method="POST",
            payload={"identity": email, "password": password},
        )
        if result and result.get("token"):
            _pb_token = result["token"]
            logger.debug("[pocketbase-crm] authenticated successfully")
        else:
            logger.warning("[pocketbase-crm] authentication failed — check PB_HERMES_PASSWORD")

    return _pb_token


def _invalidate_token() -> None:
    """Clear the cached token so the next call re-authenticates."""
    global _pb_token
    _pb_token = None


# ─── Contact lookup ────────────────────────────────────────────────────────────

async def _find_contact_id(
    pb_url: str, token: str, platform: str, user_id: str
) -> Optional[str]:
    """
    Best-effort: look up a Contact record linked to this platform user.

    Only attempted for WhatsApp (user_id == phone number).
    Returns the PocketBase record ID or None if not found / not applicable.
    """
    if platform != "whatsapp" or not user_id:
        return None

    # user_id for WhatsApp is the phone number, possibly with country code.
    # Search for contacts where `phone` contains the last 10 digits to handle
    # format differences (+584140000000 vs 4140000000 vs 0414-000-0000).
    digits = "".join(c for c in user_id if c.isdigit())
    search = digits[-10:] if len(digits) >= 10 else digits
    if not search:
        return None

    safe_search = search.replace("'", "\\'")
    query = urllib.parse.urlencode({
        "filter": f"phone ~ '{safe_search}'",
        "fields": "id",
        "perPage": "1",
        "skipTotal": "1",
    })
    result = await _run_sync(
        _http_json,
        f"{pb_url}/api/collections/contacts/records?{query}",
        token=token,
    )
    items = (result or {}).get("items", [])
    if items:
        logger.debug("[pocketbase-crm] matched contact %s for user_id %s", items[0]["id"], user_id)
        return items[0]["id"]

    return None


# ─── Conversation logging ─────────────────────────────────────────────────────

async def _log_message(
    pb_url: str,
    token: str,
    *,
    channel: str,
    direction: str,
    content: str,
    session_id: str,
    hermes_agent_id: str,
    contact_id: Optional[str],
) -> bool:
    """POST one record to the conversations collection. Returns True on success."""
    if not content.strip():
        return True  # nothing to log

    payload: dict[str, Any] = {
        "channel":         channel,
        "direction":       direction,
        "content":         content,
        "session_id":      session_id,
        "hermes_agent_id": hermes_agent_id,
    }
    if contact_id:
        payload["contact"] = contact_id

    result = await _run_sync(
        _http_json,
        f"{pb_url}/api/collections/conversations/records",
        method="POST",
        payload=payload,
        token=token,
    )
    success = result is not None and result.get("id")
    if not success:
        logger.debug("[pocketbase-crm] failed to log %s message", direction)
    return bool(success)


# ─── Entry point ───────────────────────────────────────────────────────────────

async def handle(event_type: str, context: dict) -> None:  # noqa: ARG001
    """
    Hook handler — called by Hermes after every completed agent turn.

    Context keys (from gateway/run.py::agent:end):
      platform    str   e.g. "telegram", "whatsapp", "discord"
      user_id     str   platform-specific user identifier
      chat_id     str   channel / chat room identifier
      session_id  str   Hermes session UUID (groups messages in same session)
      message     str   inbound user text (truncated to 500 chars by Hermes)
      response    str   outbound Hermes response (truncated to 500 chars)
    """
    pb_url, email, password = _config()

    if not pb_url:
        logger.debug("[pocketbase-crm] POCKETBASE_URL not set — skipping")
        return

    if not password:
        logger.warning("[pocketbase-crm] PB_HERMES_PASSWORD not set — skipping")
        return

    platform   = context.get("platform", "")   or "unknown"
    user_id    = context.get("user_id",  "")   or ""
    session_id = context.get("session_id", "") or ""
    message    = context.get("message",  "")   or ""
    response   = context.get("response", "")   or ""

    # hermes_agent_id stores "{platform}:{user_id}" for traceability.
    # This allows finding all conversations from a specific platform user
    # even when not linked to a Contact record.
    hermes_agent_id = f"{platform}:{user_id}" if user_id else platform

    # Map known platform names to the CRM channel enum values.
    # Unmapped platforms default to "web".
    channel_map = {
        "telegram":  "telegram",
        "whatsapp":  "whatsapp",
        "email":     "email",
        "discord":   "web",
        "slack":     "web",
        "local":     "web",
    }
    channel = channel_map.get(platform.lower(), "web")

    try:
        token = await _get_token(pb_url, email, password)
        if not token:
            return  # auth failed — already logged a warning

        contact_id = await _find_contact_id(pb_url, token, platform, user_id)

        kwargs = dict(
            pb_url=pb_url,
            token=token,
            session_id=session_id,
            hermes_agent_id=hermes_agent_id,
            contact_id=contact_id,
            channel=channel,
        )

        logged_in = logged_out = True

        # Log inbound message
        if message:
            logged_in = await _log_message(
                **kwargs,
                direction="inbound",
                content=message,
            )

        # Log Hermes response
        if response:
            logged_out = await _log_message(
                **kwargs,
                direction="outbound",
                content=response,
            )

        if logged_in and logged_out:
            logger.debug("[pocketbase-crm] logged turn for session %s", session_id)
        else:
            # Token may have expired mid-flight; clear cache for next turn.
            _invalidate_token()

    except Exception:
        # Hooks must NEVER crash Hermes — swallow everything.
        # Hermes hook system already logs exceptions at WARNING level.
        pass
