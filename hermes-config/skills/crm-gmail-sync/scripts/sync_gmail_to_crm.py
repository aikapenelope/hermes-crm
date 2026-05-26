#!/usr/bin/env python3
"""
Gmail → Hermes CRM sync script.

Reads recent Gmail messages (subject + sender only, no body) and writes
them to the PocketBase `email_log` collection via the REST API.
Uses thread_id for deduplication — safe to run multiple times.

Environment variables (set in ~/.hermes/.env or tenant .env):
  POCKETBASE_URL       URL of the PocketBase instance (e.g. http://pb-t001:8090)
  PB_HERMES_PASSWORD   Superuser password for hermes@internal
  PB_HERMES_EMAIL      Override superuser email (default: hermes@internal)
  HERMES_HOME          Path to Hermes data dir (default: ~/.hermes)

Usage:
  python3 sync_gmail_to_crm.py [--max N] [--days D]

  --max N    Maximum number of Gmail messages to fetch (default: 50)
  --days D   Look back this many days for messages (default: 1)

Exit codes:
  0  Success (may have synced 0 new emails due to deduplication)
  1  Configuration error (missing env vars, PB unreachable)
  2  Gmail API error
"""

import argparse
import json
import logging
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logging.basicConfig(
    level=logging.INFO,
    format="[crm-gmail-sync] %(levelname)s %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


# ── Configuration ──────────────────────────────────────────────────────────────

def load_env() -> None:
    """Load .env file from HERMES_HOME if present."""
    hermes_home = Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes"))
    env_file    = hermes_home / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                if key.strip() and key.strip() not in os.environ:
                    os.environ[key.strip()] = value.strip()


def pb_url() -> str:
    return os.environ.get("POCKETBASE_URL", "").rstrip("/")

def pb_email() -> str:
    return os.environ.get("PB_HERMES_EMAIL", "hermes@internal")

def pb_password() -> str:
    return os.environ.get("PB_HERMES_PASSWORD", "")


# ── PocketBase helpers ─────────────────────────────────────────────────────────

def pb_request(
    method: str,
    path: str,
    *,
    payload: Optional[dict] = None,
    token: Optional[str] = None,
    timeout: int = 10,
) -> dict:
    """Make an authenticated request to PocketBase. Raises on HTTP error."""
    url     = pb_url() + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(payload).encode() if payload else None
    req  = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        raise RuntimeError(f"PocketBase {method} {path} → HTTP {e.code}: {body[:200]}") from e


def pb_authenticate() -> str:
    """Authenticate with PocketBase as superuser. Returns JWT token."""
    result = pb_request(
        "POST",
        "/api/collections/_superusers/auth-with-password",
        payload={"identity": pb_email(), "password": pb_password()},
    )
    token = result.get("token")
    if not token:
        raise RuntimeError("PocketBase auth succeeded but no token in response")
    return token


def thread_id_exists(thread_id: str, token: str) -> bool:
    """Return True if this Gmail thread_id is already in email_log."""
    if not thread_id:
        return False
    safe = thread_id.replace("'", "\\'")
    try:
        result = pb_request(
            "GET",
            f"/api/collections/email_log/records?filter=thread_id='{safe}'&fields=id&perPage=1&skipTotal=1",
            token=token,
        )
        return len(result.get("items", [])) > 0
    except RuntimeError:
        return False


def create_email_log(entry: dict, token: str) -> bool:
    """Create one email_log record. Returns True on success."""
    try:
        pb_request("POST", "/api/collections/email_log/records", payload=entry, token=token)
        return True
    except RuntimeError as e:
        logger.warning("Failed to save email_log record: %s", e)
        return False


# ── Gmail helpers ──────────────────────────────────────────────────────────────

def google_api_script() -> Optional[Path]:
    """Return path to google_api.py from the google-workspace skill, if present."""
    hermes_home = Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes"))
    candidates  = [
        hermes_home / "skills" / "productivity" / "google-workspace" / "scripts" / "google_api.py",
        # Installed via hermes skills install google-workspace
        hermes_home / "skills" / "google-workspace" / "scripts" / "google_api.py",
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


def fetch_gmail_messages(max_results: int, days: int) -> list[dict]:
    """
    Fetch recent Gmail messages using the google-workspace google_api.py CLI.
    Returns a list of dicts with keys: id, from, subject, date, snippet.
    """
    gapi = google_api_script()
    if gapi is None:
        raise RuntimeError(
            "google_api.py not found. "
            "Install the google-workspace skill and complete its OAuth setup first."
        )

    query = f"newer_than:{days}d"
    cmd   = [
        sys.executable, str(gapi),
        "gmail", "search", query,
        "--max", str(max_results),
    ]
    logger.debug("Running: %s", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

    if result.returncode != 0:
        raise RuntimeError(
            f"gmail search failed (exit {result.returncode}): {result.stderr[:300]}"
        )

    try:
        messages = json.loads(result.stdout)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Could not parse gmail output as JSON: {e}") from e

    if not isinstance(messages, list):
        raise RuntimeError(f"Expected JSON array from gmail search, got: {type(messages)}")

    return messages


def parse_sender(from_field: str) -> tuple[str, str]:
    """
    Parse 'Display Name <email@example.com>' into (email, display_name).
    Falls back to (from_field, '') if parsing fails.
    """
    from_field = from_field.strip()
    if "<" in from_field and from_field.endswith(">"):
        parts = from_field.rsplit("<", 1)
        name  = parts[0].strip().strip('"').strip("'")
        email = parts[1].rstrip(">").strip()
        return email, name
    # Plain email address
    if "@" in from_field:
        return from_field, ""
    return from_field, ""


def parse_date(date_str: str) -> str:
    """
    Parse a Gmail date string into ISO 8601 format for PocketBase.
    Returns a fallback 'now' timestamp if parsing fails.
    """
    # Gmail returns dates in various formats; use email.utils if available
    try:
        from email.utils import parsedate_to_datetime
        dt = parsedate_to_datetime(date_str)
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        pass
    # Fallback
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> int:
    load_env()

    parser = argparse.ArgumentParser(description="Gmail → Hermes CRM sync")
    parser.add_argument("--max",  type=int, default=50, help="Max emails to fetch (default: 50)")
    parser.add_argument("--days", type=int, default=1,  help="Days to look back (default: 1)")
    args = parser.parse_args()

    # ── Validate config ────────────────────────────────────────────────────────
    if not pb_url():
        logger.error("POCKETBASE_URL is not set. Add it to ~/.hermes/.env")
        return 1
    if not pb_password():
        logger.error("PB_HERMES_PASSWORD is not set. Add it to ~/.hermes/.env")
        return 1

    # ── Authenticate with PocketBase ───────────────────────────────────────────
    try:
        token = pb_authenticate()
        logger.info("Authenticated with PocketBase as %s", pb_email())
    except RuntimeError as e:
        logger.error("PocketBase authentication failed: %s", e)
        return 1

    # ── Fetch Gmail messages ───────────────────────────────────────────────────
    try:
        messages = fetch_gmail_messages(args.max, args.days)
        logger.info("Fetched %d messages from Gmail (last %d days)", len(messages), args.days)
    except RuntimeError as e:
        logger.error("Gmail fetch failed: %s", e)
        return 2

    # ── Sync to PocketBase ────────────────────────────────────────────────────
    created = 0
    skipped = 0

    for msg in messages:
        # Deduplication: skip if thread_id already exists
        thread_id = str(msg.get("id") or msg.get("thread_id") or "")
        if thread_id and thread_id_exists(thread_id, token):
            skipped += 1
            continue

        from_field   = str(msg.get("from") or msg.get("sender") or "")
        email, name  = parse_sender(from_field)
        subject      = str(msg.get("subject") or "(sin asunto)").strip()
        date_str     = str(msg.get("date") or "")
        received     = parse_date(date_str) if date_str else datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

        entry = {
            "subject":     subject,
            "sender":      email or from_field,
            "sender_name": name,
            "received":    received,
            "direction":   "inbound",
            "thread_id":   thread_id,
        }

        if create_email_log(entry, token):
            created += 1
            logger.debug("Saved: %s from %s", subject[:60], email)
        else:
            skipped += 1

    logger.info(
        "Sync complete — %d new, %d skipped (already in CRM or error)",
        created, skipped,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
