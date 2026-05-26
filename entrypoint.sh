#!/bin/sh
# =============================================================================
# hermes-crm entrypoint
#
# Boot sequence:
#   1. Create/update the Hermes MCP superuser (idempotent).
#   2. Optionally restrict admin panel access by IP (PB_ADMIN_IPS).
#   3. Start PocketBase — migrations apply automatically on first serve.
#
# Two-actor authentication model
# ─────────────────────────────────────────────────────────────────────────────
#  Actor 1 — Hermes MCP (AI agent)
#    Collection:  _superusers
#    Credentials: PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD
#    Set up by:   this entrypoint, via `pocketbase superuser upsert`
#    Used by:     gaspechak-pocketbase-mcp inside the Hermes container
#    Access:      bypasses all API rules; full read/write on all data
#    Never used:  to log into the CRM web UI
#
#  Actor 2 — Business owner (human)
#    Collection:  users
#    Credentials: PB_USER_EMAIL / PB_USER_PASSWORD
#    Set up by:   migration 3_setup_tenant_auth.js (runs automatically)
#    Used by:     the CRM web app at the tenant's public URL
#    Access:      subject to collection API rules (AUTH = "@request.auth.id != ''")
#    Sees:        all data written by Hermes and all data they enter manually
#
#  These two actors CANNOT share an account. _superusers and users are
#  different collections with different JWT issuers in PocketBase.
#  They DO share all data: same SQLite rows, same contacts/deals/tasks.
#  Reference: https://pocketbase.io/docs/collections/ (auth collections)
# ─────────────────────────────────────────────────────────────────────────────
#
# Required env vars:
#   PB_SUPERUSER_EMAIL     Hermes MCP superuser (e.g. hermes@internal)
#   PB_SUPERUSER_PASSWORD  Hermes MCP password — generate: openssl rand -hex 32
#
#   PB_USER_EMAIL          Business owner login email for the CRM web UI
#   PB_USER_PASSWORD       Business owner initial password (min 8 chars)
#                          generate: openssl rand -base64 16
#
# Optional env vars:
#   PB_ADMIN_IPS           Space-separated list of IPs/CIDR ranges allowed
#                          to access the PocketBase admin panel (/_/).
#                          Works on ANY infrastructure — no Traefik required.
#
#                          Examples:
#                            PB_ADMIN_IPS="127.0.0.1"
#                            PB_ADMIN_IPS="127.0.0.1 100.64.0.0/10"
#                            PB_ADMIN_IPS="192.168.1.0/24 100.64.0.0/10"
#
#                          Recommended values by scenario:
#                            Local dev:   "127.0.0.1"
#                            VPS + SSH:   "127.0.0.1 <your-home-ip>"
#                            Martes/Tailscale: "127.0.0.1 100.64.0.0/10"
#                            No restriction: leave unset (default, less secure)
#
#                          Reference: https://pocketbase.io/docs/going-to-production/
#                          "superuser ips — restrict admin dashboard access"
#
#   PB_ENCRYPTION_KEY      32-char string to encrypt pb_data at rest.
#                          Passed as --encryptionEnv=PB_ENCRYPTION_KEY.
#                          Generate: openssl rand -hex 16
# =============================================================================
set -e

PB="/pb/pocketbase"
DATA_DIR="/pb/pb_data"

# ---------------------------------------------------------------------------
# Actor 1 — Hermes MCP superuser
# Uses `pocketbase superuser upsert` (available since v0.22, idempotent).
# Creates or updates the _superusers record.
# Reference: https://pocketbase.io/docs/going-to-production/
# ---------------------------------------------------------------------------
if [ -n "${PB_SUPERUSER_EMAIL}" ] && [ -n "${PB_SUPERUSER_PASSWORD}" ]; then
    echo "[hermes-crm] configuring Hermes superuser: ${PB_SUPERUSER_EMAIL}"
    "$PB" superuser upsert "${PB_SUPERUSER_EMAIL}" "${PB_SUPERUSER_PASSWORD}" \
        --dir="${DATA_DIR}" 2>/dev/null \
        && echo "[hermes-crm] superuser ready" \
        || echo "[hermes-crm] superuser already current"
else
    echo "[hermes-crm] WARNING: PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD not set."
    echo "[hermes-crm] Hermes MCP will not connect until these are configured."
fi

# ---------------------------------------------------------------------------
# Admin panel IP restriction (optional but strongly recommended in production)
#
# `pocketbase superuser ips` sets the IP allowlist for the /_/ admin panel.
# Any IP not on the list receives 403 — even with valid credentials.
# This is a PocketBase built-in feature independent of any reverse proxy.
#
# Works on any infrastructure:
#   - VPS with direct port exposure: set to your home IP + localhost
#   - Behind Traefik/nginx: set to Tailscale CGNAT (100.64.0.0/10) + localhost
#   - Local dev: set to 127.0.0.1 only
#
# If PB_ADMIN_IPS is not set, no restriction is applied (PocketBase default).
# This is acceptable for local development but NOT for any internet-facing deployment.
#
# Reference: https://pocketbase.io/docs/going-to-production/
# ---------------------------------------------------------------------------
if [ -n "${PB_ADMIN_IPS}" ]; then
    echo "[hermes-crm] restricting admin panel to: ${PB_ADMIN_IPS}"
    # shellcheck disable=SC2086  -- word splitting is intentional here
    "$PB" superuser ips ${PB_ADMIN_IPS} \
        --dir="${DATA_DIR}" 2>/dev/null \
        && echo "[hermes-crm] admin IP restriction applied" \
        || echo "[hermes-crm] admin IP restriction skipped (already set or PB not initialized)"
else
    echo "[hermes-crm] WARNING: PB_ADMIN_IPS is not set."
    echo "[hermes-crm] The admin panel (/_/) is accessible from any IP."
    echo "[hermes-crm] Set PB_ADMIN_IPS to restrict access in production."
fi

# ---------------------------------------------------------------------------
# Actor 2 — Business owner CRM user
# Created automatically by migration 3_setup_tenant_auth.js when PocketBase
# starts below. The migration reads PB_USER_EMAIL and PB_USER_PASSWORD from
# the environment and seeds the users collection record (idempotent).
# Reference: https://pocketbase.io/docs/js-migrations/
# ---------------------------------------------------------------------------
if [ -n "${PB_USER_EMAIL}" ] && [ -n "${PB_USER_PASSWORD}" ]; then
    echo "[hermes-crm] CRM user will be seeded on first start: ${PB_USER_EMAIL}"
else
    echo "[hermes-crm] WARNING: PB_USER_EMAIL / PB_USER_PASSWORD not set."
    echo "[hermes-crm] The CRM web UI will not be accessible until a user is created."
    echo "[hermes-crm] Create one via the admin panel at /_/ or set these env vars."
fi

# ---------------------------------------------------------------------------
# Start PocketBase
# All migrations in /pb/pb_migrations/ apply automatically on first serve.
# Migration 1: Creates 12 CRM collections + 5 SQL view segments
# Migration 2: Fixes seg_revenue_by_source SQL (removes CASE WHEN)
# Migration 3: Locks user self-registration + seeds business owner account
# Migration 4: Adds email_log + reports collections
# ---------------------------------------------------------------------------
echo "[hermes-crm] starting PocketBase..."

SERVE_ARGS="--http=0.0.0.0:8090 --dir=${DATA_DIR}"

# Optional at-rest encryption — pass the env var NAME, not its value.
# PocketBase reads the encryption key directly from the named environment variable.
# Reference: https://pocketbase.io/docs/going-to-production/
if [ -n "${PB_ENCRYPTION_KEY}" ]; then
    SERVE_ARGS="${SERVE_ARGS} --encryptionEnv=PB_ENCRYPTION_KEY"
fi

exec "$PB" serve $SERVE_ARGS
