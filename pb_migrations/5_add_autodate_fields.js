/// <reference path="../pb_data/types.d.ts" />
/**
 * Migration 5 — Add created/updated AutodateField to all CRM collections
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ROOT CAUSE
 * ─────────────────────────────────────────────────────────────────────────────
 * In PocketBase v0.22+, the system fields `created` and `updated` are NO LONGER
 * added automatically when a new base collection is saved via app.save().
 * They must be declared explicitly as AutodateField.
 *
 * Because migrations 1-4 never added these fields, the SQLite tables for
 * all CRM collections are missing the `created` and `updated` columns:
 *
 *   notes table:    contact, content, created_by, deal, id, pinned
 *   tasks table:    assigned_to, contact, deal, description, ...
 *   (no created / updated column on any user-created table)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SYMPTOMS
 * ─────────────────────────────────────────────────────────────────────────────
 * Any API request that sorts by `created` or `updated` returns:
 *   HTTP 400 "Something went wrong while processing your request."
 *
 * gaspechak-pocketbase-mcp hardcodes sort=-created in pb_record_list queries,
 * so ALL record listing calls fail with 400 → Hermes MCP becomes unreachable.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FIX
 * ─────────────────────────────────────────────────────────────────────────────
 * Add AutodateField for created and updated to every collection that is
 * missing them. The try/catch on addField handles the case where the field
 * already exists (idempotent).
 *
 * AutodateField behavior:
 *   created: set once on INSERT, never changes (onCreate=true, onUpdate=false)
 *   updated: set on INSERT and updated on every UPDATE (onCreate=true, onUpdate=true)
 *
 * Reference: https://pocketbase.io/docs/collections/
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CRM_COLLECTIONS = [
    "tags", "companies", "pipelines", "contacts", "deals",
    "tasks", "activities", "notes", "products", "deal_items",
    "goals", "email_log", "reports",
];

migrate((app) => {

    for (const name of CRM_COLLECTIONS) {
        let col;
        try {
            col = app.findCollectionByNameOrId(name);
        } catch (_) {
            // Collection not found — skip (defensive guard)
            continue;
        }

        let changed = false;

        // Add `created` if missing (set once on insert, never changes)
        try {
            col.fields.getByName("created");
            // Field already exists — skip
        } catch (_) {
            col.fields.push(new AutodateField({
                name:     "created",
                onCreate: true,
                onUpdate: false,
            }));
            changed = true;
        }

        // Add `updated` if missing (set on insert, updated on every save)
        try {
            col.fields.getByName("updated");
            // Field already exists — skip
        } catch (_) {
            col.fields.push(new AutodateField({
                name:     "updated",
                onCreate: true,
                onUpdate: true,
            }));
            changed = true;
        }

        if (changed) {
            app.save(col);
        }
    }

}, (app) => {
    // Down: remove the autodate fields added above.
    // Only removes if they exist — safe to run even if migration was partial.
    for (const name of CRM_COLLECTIONS) {
        let col;
        try {
            col = app.findCollectionByNameOrId(name);
        } catch (_) { continue; }

        let changed = false;
        for (const fieldName of ["created", "updated"]) {
            try {
                col.fields.removeByName(fieldName);
                changed = true;
            } catch (_) {}
        }
        if (changed) app.save(col);
    }
});
