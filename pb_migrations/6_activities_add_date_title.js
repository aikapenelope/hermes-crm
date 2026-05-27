/// <reference path="../pb_data/types.d.ts" />
/**
 * Migration 6 — Add date and title fields to activities collection
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PROBLEM
 * ─────────────────────────────────────────────────────────────────────────────
 * The activities collection was designed as an immutable event log, but it is
 * also used by Hermes to record scheduled appointments and meetings. Without a
 * dedicated date field, agents have no way to:
 *
 *   - Query activities by when they happen:
 *       pb_record_list(collection="activities", filter="date >= '2026-05-29'")
 *   - Display activities on the CRM calendar
 *   - Sort activities chronologically by occurrence date
 *
 * Hermes worked around this by storing the datetime inside the metadata JSON
 * field (e.g. metadata.datetime = "2026-05-29T15:00:00-05:00"). This works
 * for storage but PocketBase cannot filter or sort on nested JSON values:
 *
 *   ❌  filter: "metadata.datetime >= '2026-05-29'"  → always returns 0 results
 *   ✅  filter: "date >= '2026-05-29'"               → works correctly
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FIELDS ADDED
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * date (DateField)
 *   When the activity happened or is scheduled to happen.
 *   Distinct from `created` (when the record was saved).
 *   Format: ISO 8601 datetime, e.g. "2026-05-29 15:00:00.000Z"
 *   Optional — can be null for activities without a scheduled time.
 *   Used for calendar queries, sorting, and timeline views.
 *
 * title (TextField)
 *   Short human-readable label for the activity.
 *   Examples: "Cita con Juan Martínez", "Demo producto X", "Llamada de seguimiento"
 *   Optional — falls back to description if not set.
 *   Makes calendar display and list views more readable without loading
 *   the full description.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RECOMMENDED USAGE AFTER THIS MIGRATION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * When Hermes creates an appointment/activity it should now use:
 *
 *   pb_record_mutate(
 *     collection="activities",
 *     action="create",
 *     body={
 *       "type":        "meeting",
 *       "title":       "Cita con Juan Martínez",
 *       "description": "Revisar propuesta comercial, traer contrato firmado",
 *       "date":        "2026-05-29 20:00:00.000Z",  ← UTC equivalent of 3:00 PM -05:00
 *       "contact":     "CONTACT_ID",
 *       "metadata":    {"location": "Oficina", "duration_min": 60}
 *     }
 *   )
 *
 * Calendar queries:
 *   filter: "date >= '2026-05-01' && date <= '2026-05-31'"
 *   sort:   "date"
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IDEMPOTENCY
 * ─────────────────────────────────────────────────────────────────────────────
 * Uses try/catch around getByName to skip fields that already exist.
 * Safe to run multiple times.
 */

migrate((app) => {

    const col = app.findCollectionByNameOrId("activities");

    let changed = false;

    // ── date: when the activity happens (distinct from created/updated) ──────
    try {
        col.fields.getByName("date");
        // Field already exists — skip
    } catch (_) {
        col.fields.push(new DateField({
            name:     "date",
            required: false,
        }));
        changed = true;
    }

    // ── title: short label for the activity ──────────────────────────────────
    try {
        col.fields.getByName("title");
        // Field already exists — skip
    } catch (_) {
        col.fields.push(new TextField({
            name:     "title",
            required: false,
        }));
        changed = true;
    }

    if (changed) {
        app.save(col);
    }

}, (app) => {

    // Down: remove the fields added above
    const col = app.findCollectionByNameOrId("activities");
    let changed = false;

    for (const fieldName of ["date", "title"]) {
        try {
            col.fields.removeByName(fieldName);
            changed = true;
        } catch (_) {}
    }

    if (changed) {
        app.save(col);
    }

});
