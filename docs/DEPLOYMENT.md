# Deployment Guide

Guía completa para desplegar Hermes CRM en cualquier servidor.

---

## Opción A — Standalone (cualquier VPS)

La forma más simple. Un solo `docker compose up`.

### Prerequisitos
- Docker + Docker Compose instalados
- Servidor con al menos 256MB RAM libre
- Puerto 8090 accesible (o un dominio con HTTPS via Caddy)

### Pasos

```bash
# 1. Clonar el repo
git clone https://github.com/aikapenelope/hermes-crm.git
cd hermes-crm

# 2. Configurar variables
cp .env.example .env

# Editar .env con tus valores:
nano .env
```

Variables requeridas en `.env`:

```env
# Superuser de Hermes MCP — genera con: openssl rand -hex 32
PB_SUPERUSER_EMAIL=hermes@crm.internal
PB_SUPERUSER_PASSWORD=TU_PASS_64_CHARS_HEX

# Usuario humano (login al CRM web)
PB_USER_EMAIL=admin@tuempresa.com
PB_USER_PASSWORD=TU_PASS_64_CHARS_HEX

# IPs que pueden acceder al panel admin /_/
# Si Hermes corre en Docker en el mismo servidor: incluir 172.16.0.0/12
PB_ADMIN_IPS=127.0.0.1 100.64.0.0/10 172.16.0.0/12
```

> ⚠️ **IMPORTANTE:** Usar `openssl rand -hex 32` para las contraseñas.
> NO usar `openssl rand -base64 16` — el `=` al final rompe el parsing.

```bash
# 3. Levantar
docker compose up -d

# 4. Verificar
docker compose logs -f crm
# Deberías ver:
# [hermes-crm] superuser ready
# [hermes-crm] admin IP restriction applied
# 2026/xx/xx Server started at http://0.0.0.0:8090

# 5. Acceder
open http://TU_IP:8090
```

---

## Opción B — Con HTTPS automático (Caddy incluido)

Para acceso desde internet con TLS automático vía Let's Encrypt.

```bash
# Requiere un dominio apuntando al servidor
DOMAIN=crm.tuempresa.com docker compose --profile with-caddy up -d
```

El CRM quedará en `https://crm.tuempresa.com` con certificado automático.

---

## Opción C — Dentro de Mastra/qyne-v1

Para integrarlo en el stack existente de qyne-v1.

```yaml
# En /opt/qyne-v1/docker-compose.yml
pocketbase:
  image: ghcr.io/aikapenelope/hermes-crm:latest
  container_name: qyne-pocketbase
  restart: unless-stopped
  environment:
    PB_SUPERUSER_EMAIL:    ${PB_SUPERUSER_EMAIL:?required}
    PB_SUPERUSER_PASSWORD: ${PB_SUPERUSER_PASSWORD:?required}
    PB_USER_EMAIL:    ${PB_USER_EMAIL:?required}
    PB_USER_PASSWORD: ${PB_USER_PASSWORD:?required}
    PB_ADMIN_IPS: "127.0.0.1 100.64.0.0/10 172.16.0.0/12"
    GOMEMLIMIT: 200MiB
  volumes:
    - pocketbase-data:/pb/pb_data
  ports:
    - "127.0.0.1:8090:8090"
  networks:
    - qyne
```

Acceso vía Tailscale: `http://100.120.80.93:8090/`

---

## Persistencia de datos

```bash
# Los datos están en un volumen Docker nombrado
docker volume ls | grep pocketbase

# Backup manual
docker run --rm \
  -v qyne-v1_pocketbase-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/crm-backup-$(date +%Y%m%d).tar.gz /data

# Restaurar backup
docker run --rm \
  -v qyne-v1_pocketbase-data:/data \
  -v $(pwd):/backup \
  alpine sh -c "cd / && tar xzf /backup/crm-backup-YYYYMMDD.tar.gz"
```

---

## Actualizar la UI sin reconstruir la imagen

Cuando hay cambios en el frontend que aún no están en GHCR:

```bash
# En el workspace del repo
cd ui
npm install
npm run build

# Comprimir el build
cd build && tar czf /tmp/pb_ui.tar.gz .

# Copiar al container
scp /tmp/pb_ui.tar.gz server:/tmp/
ssh server "
  rm -rf /tmp/pb_ui_dir && mkdir /tmp/pb_ui_dir
  tar xzf /tmp/pb_ui.tar.gz -C /tmp/pb_ui_dir
  docker exec -u root qyne-pocketbase sh -c 'rm -rf /pb/pb_public/*'
  docker cp /tmp/pb_ui_dir/. qyne-pocketbase:/pb/pb_public/
  docker exec -u root qyne-pocketbase chown -R pocketbase:pocketbase /pb/pb_public/
"
```

> ⚠️ Los cambios de `docker cp` sobreviven `docker restart` pero se PIERDEN
> en `docker compose up --force-recreate`. Para persistencia permanente,
> mergear el PR para que GitHub Actions reconstruya la imagen GHCR.

---

## Aplicar migraciones nuevas en instancia existente

Las migraciones JS de PocketBase tienen un problema en v0.38: el comando
`migrate up` dice "Applied" pero NO crea las columnas SQLite. Se requiere
el script de corrección manual:

```bash
# 1. Copiar la migración al container
docker cp pb_migrations/NUEVA_MIGRACION.js qyne-pocketbase:/pb/pb_migrations/

# 2. Aplicar (registra la migración)
docker exec qyne-pocketbase /pb/pocketbase migrate up --dir=/pb/pb_data

# 3. Crear las columnas físicas en SQLite (necesario en v0.38)
# Ver docs/KNOWN_ISSUES.md sección "Migration column creation bug"
```

---

## Variables de entorno referencia

| Variable | Requerida | Descripción |
|---|---|---|
| `PB_SUPERUSER_EMAIL` | ✅ | Email del superuser de Hermes MCP. Debe ser email válido con TLD (ej: hermes@crm.internal) |
| `PB_SUPERUSER_PASSWORD` | ✅ | Contraseña del superuser. Generar con `openssl rand -hex 32` |
| `PB_USER_EMAIL` | ✅ | Email del usuario humano para el CRM web |
| `PB_USER_PASSWORD` | ✅ | Contraseña del usuario humano |
| `PB_ADMIN_IPS` | Recomendada | IPs/CIDRs con acceso al panel `/_/` y a la API de superuser |
| `PB_ENCRYPTION_KEY` | Opcional | Clave para cifrar `pb_data` en reposo. Generar con `openssl rand -hex 16`. Si se pierde, los datos son irrecuperables |
| `CRM_PORT` | Opcional | Puerto donde escucha el CRM (default: 8090) |
| `DOMAIN` | Solo con-caddy | Dominio para TLS automático via Let's Encrypt |
| `GOMEMLIMIT` | Opcional | Límite de heap Go. Default en compose: 200MiB |

---

## Diagnóstico rápido

```bash
# ¿Está sano el container?
docker inspect qyne-pocketbase --format '{{.State.Status}}'
curl http://localhost:8090/api/health

# ¿Migraciones aplicadas?
python3 -c "
import sqlite3
c = sqlite3.connect('/var/lib/docker/volumes/.../data.db').cursor()
c.execute('SELECT file FROM _migrations ORDER BY file')
for r in c.fetchall(): print(r[0])
"

# ¿Logging activo?
ls -la /var/lib/docker/volumes/qyne-v1_pocketbase-data/_data/logs.db
# Debe ser owner pocketbase (uid 1001), no root

# Fix si logs.db es de root:
docker exec -u root qyne-pocketbase chown pocketbase:pocketbase /pb/pb_data/logs.db
```
