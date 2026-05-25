# =============================================================================
# hermes-crm — Multi-stage Dockerfile
#
# Stage 1 (ui-builder): Compiles the SvelteKit SPA into ui/build/
# Stage 2 (runtime):    Alpine + PocketBase binary + migrations + built SPA
#
# Usage:
#   docker build -t hermes-crm:latest .
#   docker run -d \
#     -v /var/lib/martes/tenants/t001/pb_data:/pb/pb_data \
#     -e PB_SUPERUSER_EMAIL=hermes@internal \
#     -e PB_SUPERUSER_PASSWORD=<secret> \
#     hermes-crm:latest
#
# On first start:
#   - Superuser created from env vars
#   - pb_migrations/1_init_crm.js applies automatically (all 13 collections)
#   - SvelteKit SPA served at /  (same origin as the API — no CORS)
#   - Admin panel at /_/
#   - REST API at /api/
# =============================================================================

# ── Stage 1: build the SvelteKit SPA ─────────────────────────────────────────
FROM node:20-alpine AS ui-builder

WORKDIR /ui

# Layer cache: install deps first, only re-run when package files change
COPY ui/package.json ui/package-lock.json ./
RUN npm ci --prefer-offline --no-audit --silent

COPY ui/ .
RUN npm run build


# ── Stage 2: PocketBase runtime ───────────────────────────────────────────────
FROM alpine:latest

ARG PB_VERSION=0.38.2

# ca-certificates: HTTPS for PB update checks / external calls
# wget + unzip: download PocketBase release zip
RUN apk add --no-cache ca-certificates wget unzip \
    && wget -q \
        "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
        -O /tmp/pb.zip \
    && unzip -q /tmp/pb.zip pocketbase -d /pb \
    && rm /tmp/pb.zip \
    && chmod +x /pb/pocketbase

# Migrations — baked into the image, auto-applied on first serve
COPY pb_migrations/ /pb/pb_migrations/

# SvelteKit SPA — served at / by PocketBase's static file handler
COPY --from=ui-builder /ui/build/ /pb/pb_public/

# Entrypoint: creates superuser from env vars, then starts PocketBase
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /pb

# pb_data: SQLite database + uploaded files + logs
# Mount this volume to persist data across container restarts
VOLUME ["/pb/pb_data"]

EXPOSE 8090

# Soft cap on Go heap — prevents runaway memory under bursty CRM load
ENV GOMEMLIMIT=200MiB

ENTRYPOINT ["/entrypoint.sh"]
