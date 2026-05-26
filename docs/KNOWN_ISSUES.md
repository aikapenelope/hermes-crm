# Known Issues & Hardening Roadmap

Estado actual del sistema, bugs conocidos y qué hace falta para que sea más robusto.
Actualizado: mayo 2026.

---

## 🔴 Crítico — se rompe solo en producción

### 1. UI changes no sobreviven `--force-recreate` ni `docker pull`

**Problema:** `/pb/pb_public/` vive dentro de la capa writable del contenedor, no en un volumen. Los cambios del UI desplegados vía `docker cp` se conservan en un simple `docker restart`, pero se pierden completamente en:
- `docker compose up -d --force-recreate pocketbase`
- `docker pull ghcr.io/aikapenelope/hermes-crm:latest` + recreate
- Cualquier operación que recree el contenedor desde la imagen

**Evidencia:**
```
Container nodes (after docker cp): 20  ← nuestra UI actualizada
GHCR image nodes:                  17  ← UI original sin features
```

**Fix permanente (2 opciones):**

A) Mount `/pb/pb_public` como volume bind en `docker-compose.yml`:
```yaml
volumes:
  - pocketbase-data:/pb/pb_data
  - ./pb_public:/pb/pb_public   # ← agregar esto
```
Luego copiar el build del UI al directorio `pb_public/` en el host.

B) Hacer push de la imagen con el UI actualizado a GHCR para que el container use la imagen correcta y no haya discrepancia:
```bash
docker build -t ghcr.io/aikapenelope/hermes-crm:latest .
docker push ghcr.io/aikapenelope/hermes-crm:latest
```
La imagen usa un multi-stage build (Dockerfile) que ya incluye el `npm run build` del UI.
Al hacer push se actualiza GHCR y el próximo pull/recreate usa la imagen correcta.

**Recomendación:** Opción B cuando el PR se mergee. La imagen se reconstruye automáticamente por GitHub Actions en cada push a `main`.

---

### 2. `logs.db` propiedad de root — logging roto

**Problema:**
```
-rw-r--r-- 1 root root 0 logs.db
```
El contenedor corre como usuario `pocketbase` (uid 1001). No puede escribir en `logs.db`.
Resultado: cero logs de requests, sin audit trail, sin métricas de uso, errores silenciosos.

**Fix inmediato (sin reiniciar):**
```bash
docker exec -u root qyne-pocketbase chown pocketbase:pocketbase /pb/pb_data/logs.db
```

**Fix permanente:** El `entrypoint.sh` debería incluir:
```sh
touch /pb/pb_data/logs.db
chown pocketbase:pocketbase /pb/pb_data/logs.db 2>/dev/null || true
```
Pero el entrypoint corre como uid 1001 y no puede hacer chown. La solución real es
crear el archivo con los permisos correctos en el `Dockerfile` o como `init-container`.

---

### 3. Cero backups — pérdida total si el disco falla

**Problema:** No hay directorio de backups, no hay cron de backup, no hay snapshots del volumen Docker.
Si el servidor falla o alguien ejecuta `docker compose down -v`, todos los datos se pierden.

**Fix:** Hermes puede hacer backups automáticos vía la API de PocketBase:
```
POST /api/backups
Authorization: superuser token
```
O desde el host:
```bash
# Cron diario a las 3 AM
0 3 * * * docker exec qyne-pocketbase /pb/pocketbase backup --dir=/pb/pb_data >> /var/log/pb-backup.log 2>&1
# Copiar backup fuera del servidor (S3, rsync, etc.)
```

---

## 🟡 Moderado — funcionamiento degradado

### 4. `contacts.source` no incluye 'import' ni 'csv'

**Problema:** La página `/contacts/import` guarda `source: 'import'` pero el campo `source`
en la colección solo acepta:
```
manual | whatsapp | instagram | web | referral | email | other
```
PocketBase rechaza el valor 'import' → los contactos importados vía CSV no guardan su fuente.

**Fix:** Migration 8 que agrega 'import' y 'csv' a los valores del SelectField.

---

### 5. `activities.updateRule = null` — UI no puede editar actividades

**Problema:** `updateRule: null` significa que solo el superuser (Hermes vía MCP) puede
actualizar actividades. El usuario del CRM web no puede editar la fecha o el título de una
actividad existente.

Las actividades de Juan y Pedro creadas antes de migration 6 tienen `date = null` y no
pueden corregirse desde la UI web.

**Fix:**
- Cambiar `updateRule` a `@request.auth.id != ""` para permitir edición desde la UI
- O mantener `null` (solo Hermes puede corregir vía MCP: `pocketbase_update_record`)

**Decisión de diseño:** si las activities son un log inmutable de eventos pasados,
`null` es correcto. Si también se usan para citas futuras (appointments), necesitan ser editables.

---

### 6. `goals` sin campo de progreso

**Problema:** La colección `goals` tiene `target` (meta numérica) pero no tiene `current`
(valor actual). La página de Metas no puede mostrar porcentaje de progreso ni barras.

**Campos faltantes:**
- `current` (NumberField, min: 0) — valor actual del indicador
- `notes` (TextField) — observaciones sobre la meta

**Fix:** Migration 8 que agrega estos campos.

---

### 7. `contacts` sin campos de ubicación ni WhatsApp

**Problema:** Para un CRM latinoamericano que opera principalmente por WhatsApp:
- No hay `whatsapp` (bool) → no sabemos si el número está en WA
- No hay `city` ni `country` → sin segmentación geográfica
- No hay `birthday` (DateField) → sin recordatorios de cumpleaños
- No hay `timezone` → Hermes no sabe en qué horario agendar citas

Las empresas SÍ tienen `city`/`country`. Los contactos no.

**Fix:** Migration 8 que agrega estos campos.

---

### 8. WAL files sin checkpoint — riesgo de corrupción en shutdown abrupto

**Problema:**
```
data.db-wal:      41KB
auxiliary.db-wal: 1.3MB
```
Los archivos WAL crecen indefinidamente sin checkpoint. Si el proceso muere por SIGKILL
(OOM killer, `docker kill`, corte de luz), SQLite puede quedar en estado inconsistente.

**Observación:** PocketBase hace checkpoint automático, pero con carga esporádica
(este servidor tiene actividad bursty) puede no ocurrir con suficiente frecuencia.

**Mitigación:** `PRAGMA wal_checkpoint(TRUNCATE)` periódico, o confiar en que PocketBase
lo maneja (lo hace en cada `graceful shutdown`). Asegurar que el container siempre
se detenga con `docker stop` (SIGTERM) y nunca `docker kill` (SIGKILL).

---

## 🟢 Mejoras de robustez — bajo riesgo, alto valor

### 9. MCP: `pocketbase_connect` + `pocketbase_auth_admin` manual en cada sesión

**Problema:** `@feirelles/pocketbase-mcp@2.0.0` no guarda estado entre reinicios de Hermes.
Hermes debe llamar `pocketbase_connect` + `pocketbase_auth_admin` al inicio de cada sesión.
Si Hermes se reinicia automáticamente (OOM, error), la primera operación CRM falla.

**Fix:** Documentar en SOUL.md que Hermes debe re-conectar si recibe "no connections registered".
O buscar un paquete MCP que pre-conecte vía env vars.

---

### 10. Dashboard hace `getFullList` sobre todas las colecciones

**Problema:** Al cargar el dashboard, se descargan TODOS los contactos, deals y tasks sin
paginación. Con 2 registros actuales: imperceptible. Con 500+ registros: 3–5 segundos de carga.

```typescript
// dashboard/+page.svelte — actual (problemático a escala)
pb.collection('contacts').getFullList({ fields: 'status' })  // todos
pb.collection('deals').getFullList({ fields: 'stage,value' }) // todos
pb.collection('tasks').getFullList({ fields: 'priority,status,due_date' }) // todos
```

**Fix:** Reemplazar con queries de agregado o views SQL:
```typescript
// Alternativa eficiente
pb.collection('contacts').getList(1, 1, { fields: 'id' }) // solo para totalItems
```
O crear view collections que pre-calculen las métricas del dashboard.

---

### 11. Realtime no configurado en deals, tasks (solo en contacts)

**Problema:** Solo la lista de contactos tiene subscripción realtime. Los deals y tasks
no se actualizan automáticamente cuando Hermes escribe via MCP.

**Fix:** Agregar `pb.collection('tasks').subscribe('*', handler)` en tasks/+page.svelte
y deals/+page.svelte, con `onDestroy` cleanup.

---

### 12. No hay duplicate detection en contactos

**Problema:** Si el mismo número de teléfono se importa dos veces (o Hermes crea un
contacto que ya existe), se crean duplicados. PocketBase no tiene constraints de unicidad
en `phone` ni `email` por defecto.

**Fix:** Antes de crear, hacer `getList` con `filter: "phone='...' || email='...'"`.
Mostrar un aviso si hay coincidencias. La página de importación CSV debería hacer esto
antes del batch insert.

---

## Resumen de migrations pendientes

| Migration | Qué agrega |
|---|---|
| 8_schema_improvements.js | `contacts.source` + 'import'/'csv', `contacts.whatsapp` bool, `contacts.city`/`country`, `goals.current` NumberField, `goals.notes` TextField |

---

## Resumen de docker-compose.yml fixes pendientes

| Fix | Qué resuelve |
|---|---|
| Volume mount de `pb_public` | UI persiste entre recreaciones |
| Cron backup diario | Protección de datos |
| `entrypoint.sh` fix logs.db | Request logging funcional |
