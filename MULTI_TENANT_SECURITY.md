# Multi-Tenant Security Guide

Running multiple Hermes+CRM instances on the same server — isolation model,
attack surface, and recommended network architecture.

---

## How isolation works by default

### MCP transport: stdio (absolutely isolated)

When Hermes starts a CRM MCP server, it spawns `npx @feirelles/pocketbase-mcp`
as a **child process** connected via `stdin/stdout` pipe:

```
Hermes-A (container)
  └─ spawn: npx @feirelles/pocketbase-mcp   ← child process of Hermes-A
       └─ stdin/stdout pipe ← OS-level pipe, private to these two processes
       └─ HTTP → pb-a:8090 → SQLite (tenant A data)

Hermes-B (container)
  └─ spawn: npx @feirelles/pocketbase-mcp   ← child process of Hermes-B
       └─ stdin/stdout pipe ← different pipe, invisible to Hermes-A
       └─ HTTP → pb-b:8090 → SQLite (tenant B data)
```

**Properties of stdio isolation:**
- The pipe is a kernel-level file descriptor pair. No other process can join it.
- There is no MCP registry, broker, or shared bus. Each Hermes only reads its
  own `config.yaml` and knows nothing about other instances.
- If `docker restart hermes-a`, the MCP child dies with it and a new one spawns.
  Hermes-B is not affected and does not observe the event.

### PocketBase data: completely isolated

Each PocketBase instance is a separate container with its own SQLite database
file in its own Docker volume:

```
/var/lib/docker/volumes/tenant-a_pb-data/  →  data.db (tenant A)
/var/lib/docker/volumes/tenant-b_pb-data/  →  data.db (tenant B)
```

There is no shared database, no shared file system, no shared connection pool.
Even if both containers run on the same host, their data is physically separate.

---

## The REST fallback — where isolation breaks

Hermes can bypass the MCP and call PocketBase directly via Python HTTP requests
(it does this automatically when the MCP is unavailable):

```python
import requests
response = requests.post(
    "http://localhost:8090/api/collections/_superusers/auth-with-password",
    json={"identity": "hermes@crm.internal", "password": "..."}
)
```

This uses the **network stack**, not a pipe. Network requests are subject to
routing rules, and those rules depend on how containers are configured.

### Vulnerable setup: `--network host`

If Hermes runs with `--network host`, `localhost` inside the container is the
**host machine's loopback interface**, which sees all services bound to
`127.0.0.1` on the host:

```
Host: 10.0.0.1

Ports bound to 127.0.0.1:
  :8090 → PocketBase-A (tenant Ana)
  :8091 → PocketBase-B (tenant Luis)    ← also visible
  :8092 → PocketBase-C (tenant Carlos)  ← also visible

Hermes-A with --network host:
  Can reach :8090  ✅  its own
  Can reach :8091  ⚠️  tenant Luis's data
  Can reach :8092  ⚠️  tenant Carlos's data
```

If Hermes-A's model is instructed (via a malicious prompt or a bug) to call
`http://localhost:8091`, it can read and write tenant B's data if it has valid
credentials or if tenant B's PocketBase has misconfigured API rules.

**This is the only real attack vector in the current single-tenant deployment.**
For a single tenant it does not matter. For multi-tenant, it must be addressed.

---

## Recommended architecture: per-tenant bridge network

Each tenant gets an isolated Docker bridge network. Hermes and PocketBase for
that tenant share only that network. No `--network host`.

```yaml
# docker-compose.tenant-a.yml
services:
  hermes-a:
    image: nousresearch/hermes-agent:latest
    container_name: hermes-a
    restart: unless-stopped
    networks:
      - net-a                   # ← only net-a
    volumes:
      - ./tenants/a/hermes:/opt/data
    environment:
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY_A}
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN_A}
      TELEGRAM_ALLOWED_USERS: ${TELEGRAM_ALLOWED_USERS_A}

  pb-a:
    image: ghcr.io/aikapenelope/hermes-crm:latest
    container_name: pb-a
    restart: unless-stopped
    networks:
      - net-a                   # ← only net-a
    volumes:
      - pb-a-data:/pb/pb_data
    environment:
      PB_SUPERUSER_EMAIL:    hermes@crm.internal
      PB_SUPERUSER_PASSWORD: ${PB_PASSWORD_A}
      PB_USER_EMAIL:         ${CRM_USER_EMAIL_A}
      PB_USER_PASSWORD:      ${CRM_USER_PASSWORD_A}
      PB_ADMIN_IPS:          "127.0.0.1 172.16.0.0/12"
    # NO ports: — not published to the host

networks:
  net-a:
    driver: bridge
    # Isolated bridge. Docker does not route traffic between net-a and net-b.

volumes:
  pb-a-data:
```

Repeat with `hermes-b`, `pb-b`, `net-b` for tenant B.

### Why this provides strong isolation

| Attempt from Hermes-A | Result |
|---|---|
| `http://pb-a:8090` (Docker DNS) | ✅ Resolves — on same network |
| `http://pb-b:8090` (Docker DNS) | ❌ DNS NXDOMAIN — `pb-b` not in `net-a` |
| `http://10.0.0.1:8091` (host IP, if pb-b port published) | ❌ No port published → connection refused |
| `http://172.17.0.3:8090` (guessing PocketBase-B's bridge IP) | ❌ Bridge networks are isolated; Docker does not route between them |

The bridge isolation is enforced by the Linux network namespace and iptables
rules that Docker manages automatically.

### Hermes config.yaml per tenant

Each Hermes instance has its own `config.yaml` pointing to its own PocketBase
by Docker DNS name, not `localhost`:

```yaml
# /tenants/a/hermes/config.yaml
mcp_servers:
  crm:
    command: npx
    args: ["-y", "@feirelles/pocketbase-mcp@2.0.0"]
    env:
      PB_URL: "http://pb-a:8090"          # Docker DNS — only resolves in net-a
      PB_EMAIL: "hermes@crm.internal"
      PB_PASSWORD: "${PB_PASSWORD_A}"
```

```yaml
# /tenants/b/hermes/config.yaml
mcp_servers:
  crm:
    command: npx
    args: ["-y", "@feirelles/pocketbase-mcp@2.0.0"]
    env:
      PB_URL: "http://pb-b:8090"          # different DNS name, different network
      PB_EMAIL: "hermes@crm.internal"
      PB_PASSWORD: "${PB_PASSWORD_B}"
```

Hermes-A has no way to know `pb-b` exists. Even if it tried `http://pb-b:8090`,
the DNS lookup fails because `pb-b` is not in `net-a`.

---

## Accessing the CRM web UI per tenant

Without host-port publishing, each tenant's CRM is not reachable from the
outside by default. Expose it through a reverse proxy (Traefik, Caddy, or
nginx) using the subdomain pattern:

```
crm-a.yourdomain.com → pb-a:8090  (via Traefik label or Caddyfile)
crm-b.yourdomain.com → pb-b:8090
```

Or, for Tailscale-only access, run a socat bridge per tenant:

```bash
# On the host (add to /etc/rc.local or systemd service):
socat TCP-LISTEN:8090,bind=100.64.x.x,reuseaddr,fork TCP:$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' pb-a):8090 &
socat TCP-LISTEN:8091,bind=100.64.x.x,reuseaddr,fork TCP:$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' pb-b):8090 &
```

---

## Security model summary

| Layer | Mechanism | Isolation strength |
|---|---|---|
| MCP stdio transport | OS pipe between Hermes and its child process | **Absolute** — kernel-level |
| PocketBase SQLite | Separate container, separate volume, separate file | **Absolute** — physical separation |
| Docker bridge networks | Linux network namespaces + iptables | **Strong** — enforced by kernel |
| PocketBase API rules | `listRule: "@request.auth.id != \"\""` | **Moderate** — bypassed by superuser |
| `PB_ADMIN_IPS` | IP allowlist for superuser API | **Defense-in-depth** |
| REST fallback (localhost) | No isolation with `--network host` | **None** — requires bridge networks |

### Decision table

| Deployment | Recommendation |
|---|---|
| Single tenant on VPS | Current setup is fine. `--network host` is acceptable. |
| 2–5 tenants on same server | Use per-tenant bridge networks. Remove `--network host`. |
| 5+ tenants or SaaS | Consider separate VMs or a container orchestrator (Nomad, k8s). |

### What an attacker would need to exploit the REST fallback

Even with `--network host`, a successful attack requires all of the following:

1. Ability to inject instructions into a Hermes session (prompt injection)
2. Knowledge of tenant B's PocketBase port number
3. Knowledge of tenant B's superuser credentials
4. Tenant B's `PB_ADMIN_IPS` not blocking the source IP

This is a low-probability but real vector for multi-tenant deployments. The
per-tenant bridge network eliminates it at the infrastructure level.

---

## Checklist: hardening a multi-tenant deployment

- [ ] Each tenant in its own Docker bridge network (`net-a`, `net-b`, …)
- [ ] No `--network host` on any Hermes container
- [ ] PocketBase not publishing ports to the host (`# NO ports:`)
- [ ] Each Hermes `config.yaml` uses Docker DNS name (`http://pb-a:8090`), not `localhost`
- [ ] Different `PB_SUPERUSER_PASSWORD` per tenant
- [ ] `PB_ADMIN_IPS` includes `172.16.0.0/12` but NOT `0.0.0.0/0`
- [ ] CRM web access via reverse proxy (Traefik/Caddy) with HTTPS, not raw port exposure
- [ ] Each tenant's `.env` file mode `0600`, readable only by root
