# =============================================================================
# hermes-crm — Multi-stage Dockerfile
#
# Stage 1 (ui-builder): Compiles the SvelteKit SPA into ui/build/
# Stage 2 (runtime):    Alpine + PocketBase binary + migrations + built SPA
#
# Published image: ghcr.io/aikapenelope/hermes-crm:latest
#
# Usage — any VPS:
#   docker run -d \
#     -p 8090:8090 \
#     -v /path/to/pb_data:/pb/pb_data \
#     -e PB_SUPERUSER_EMAIL=hermes@internal \
#     -e PB_SUPERUSER_PASSWORD=$(openssl rand -hex 32) \
#     -e PB_USER_EMAIL=owner@email.com \
#     -e PB_USER_PASSWORD=$(openssl rand -base64 16) \
#     ghcr.io/aikapenelope/hermes-crm:latest
#
# On first start (fully automatic):
#   - Superuser created from env vars (Hermes MCP access)
#   - All migrations apply (12 CRM collections + 5 segments + auth setup)
#   - CRM user seeded from env vars (web UI login)
#   - SvelteKit SPA served at /   (same origin as API — zero CORS config)
#   - Admin panel at /_/           (restrict with PB_ADMIN_IPS in production)
#   - REST API at /api/
#
# Security model:
#   - Runs as non-root user 'pocketbase' (uid 1001)
#   - wget and unzip removed after PocketBase binary is downloaded
#   - Only ca-certificates retained (needed for HTTPS calls)
#   - HEALTHCHECK: Docker monitors /api/health every 30s
# =============================================================================

# ── Stage 1: build the SvelteKit SPA ─────────────────────────────────────────
FROM node:20-alpine AS ui-builder

WORKDIR /ui

# Layer cache: copy lockfiles first so npm ci only re-runs on dependency changes.
# Changing UI source code does NOT invalidate this layer.
COPY ui/package.json ui/package-lock.json ./
RUN npm ci --prefer-offline --no-audit --silent

COPY ui/ .
RUN npm run build


# ── Stage 2: PocketBase runtime ───────────────────────────────────────────────
FROM alpine:latest

ARG PB_VERSION=0.38.2

# Determine architecture at build time for the correct PocketBase binary.
# buildx passes TARGETARCH automatically (amd64 or arm64).
ARG TARGETARCH=amd64

# Download PocketBase, install binary, then REMOVE download tools immediately.
# This keeps the final image minimal: only ca-certificates stays (needed for
# PocketBase HTTPS outbound calls and Let's Encrypt verification).
#
# Attack surface reduction: wget and unzip are removed once their single-use
# task is complete. The PocketBase binary itself is a static Go binary —
# no dynamic library dependencies.
RUN apk add --no-cache ca-certificates wget unzip \
    && wget -q \
        "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" \
        -O /tmp/pb.zip \
    && unzip -q /tmp/pb.zip pocketbase -d /pb \
    && rm /tmp/pb.zip \
    && chmod +x /pb/pocketbase \
    && apk del wget unzip \
    && rm -rf /var/cache/apk/*

# Non-root user for the PocketBase process.
# Using a fixed uid (1001) so volume mounts on the host can be pre-chowned
# if needed (e.g. chown -R 1001:1001 /path/to/pb_data).
RUN addgroup -g 1001 -S pocketbase \
    && adduser  -u 1001 -S -G pocketbase -H pocketbase

# Migrations: baked into the image, auto-applied on first pocketbase serve.
# The migrations directory is read-only inside the container.
COPY pb_migrations/ /pb/pb_migrations/

# SvelteKit SPA: served statically by PocketBase at the root path.
# Same origin as the /api/ endpoint — no CORS configuration required.
COPY --from=ui-builder /ui/build/ /pb/pb_public/

# Entrypoint script: creates actors (superuser + CRM user) then starts PocketBase.
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Ensure the non-root user owns all application files
RUN chown -R pocketbase:pocketbase /pb /entrypoint.sh

WORKDIR /pb

# Switch to non-root user for all subsequent operations
USER pocketbase

# pb_data: SQLite database + uploaded files + request logs.
# Mount an external volume here. Without a volume mount, data is ephemeral.
VOLUME ["/pb/pb_data"]

EXPOSE 8090

# Soft cap on Go heap — prevents runaway memory under bursty load.
# PocketBase typically uses 30-80 MB idle; this cap allows up to 200 MB.
ENV GOMEMLIMIT=200MiB

# Docker health check: polls the PocketBase health endpoint every 30 seconds.
# If the endpoint fails 3 consecutive times, Docker marks the container
# unhealthy and Coolify/Portainer/compose can trigger a restart policy.
# start_period: allow up to 30s for migrations and startup before checking.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://localhost:8090/api/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
