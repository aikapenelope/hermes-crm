#!/bin/sh
# =============================================================================
# hermes-crm entrypoint
#
# 1. Creates/updates the superuser from env vars (idempotent — safe to re-run).
# 2. Starts PocketBase. Migrations in pb_migrations/ apply automatically.
#
# Required env vars:
#   PB_SUPERUSER_EMAIL     - superuser email (e.g. hermes@internal)
#   PB_SUPERUSER_PASSWORD  - superuser password
#
# Optional env vars:
#   PB_ENCRYPTION_KEY      - 32-char string to encrypt pb_data at rest
#                            passed via --encryptionEnv=PB_ENCRYPTION_KEY
# =============================================================================
set -e

PB="/pb/pocketbase"
DATA_DIR="/pb/pb_data"

# ---------------------------------------------------------------------------
# Superuser creation (idempotent via upsert — available since PocketBase v0.22)
# ---------------------------------------------------------------------------
if [ -n "${PB_SUPERUSER_EMAIL}" ] && [ -n "${PB_SUPERUSER_PASSWORD}" ]; then
    echo "[hermes-crm] configuring superuser: ${PB_SUPERUSER_EMAIL}"
    "$PB" superuser upsert "${PB_SUPERUSER_EMAIL}" "${PB_SUPERUSER_PASSWORD}" \
        --dir="${DATA_DIR}" 2>/dev/null \
        && echo "[hermes-crm] superuser ready" \
        || echo "[hermes-crm] superuser upsert skipped (already current)"
else
    echo "[hermes-crm] WARNING: PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD not set."
    echo "[hermes-crm] You will need to complete setup via the Admin UI at /_/"
fi

# ---------------------------------------------------------------------------
# Start PocketBase
# Migrations in /pb/pb_migrations/ apply automatically on first serve.
# ---------------------------------------------------------------------------
echo "[hermes-crm] starting PocketBase..."

SERVE_ARGS="--http=0.0.0.0:8090 --dir=${DATA_DIR}"

# Optional at-rest encryption: pass key name, not the key value
if [ -n "${PB_ENCRYPTION_KEY}" ]; then
    SERVE_ARGS="${SERVE_ARGS} --encryptionEnv=PB_ENCRYPTION_KEY"
fi

exec "$PB" serve $SERVE_ARGS
