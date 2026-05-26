/// <reference path="../pb_data/types.d.ts" />
/**
 * Migration 3 — Tenant user setup (auth production hardening)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONTEXT — Two-actor model
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This CRM is accessed by exactly two actors, using separate PocketBase
 * auth collections:
 *
 *  ┌─ _superusers (hermes@internal) ───────────────────────────────────────┐
 *  │  • Set up by entrypoint.sh via `pocketbase superuser upsert`          │
 *  │  • Used by: Hermes MCP (gaspechak-pocketbase-mcp)                     │
 *  │  • Bypasses ALL collection API rules (superuser privilege)             │
 *  │  • Can create contacts, deals, tasks, notes on behalf of the tenant   │
 *  │  • Never used to log into the CRM web UI                              │
 *  └───────────────────────────────────────────────────────────────────────┘
 *
 *  ┌─ users (tenant business owner) ───────────────────────────────────────┐
 *  │  • Seeded here from PB_USER_EMAIL / PB_USER_PASSWORD env vars         │
 *  │  • Used by: the human business owner via the CRM web app              │
 *  │  • Subject to collection API rules (AUTH = "@request.auth.id != ''")  │
 *  │  • Sees and edits the same data Hermes writes via MCP                 │
 *  └───────────────────────────────────────────────────────────────────────┘
 *
 * They CANNOT share an account: `_superusers` and `users` are different
 * collections with different JWT issuers and different security models.
 * They DO share all data: same SQLite database, same rows in contacts/deals/tasks.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS MIGRATION DOES
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Step 1 — Lock self-registration
 *   Sets `createRule: null` on the users collection, which means:
 *   "only an authorized superuser can create user records"
 *   (PocketBase docs: "locked — aka null, superuser only. This is the default.")
 *   Without this, anyone who knows the API endpoint can create an account.
 *   Reference: https://pocketbase.io/docs/api-rules-and-filters/
 *
 * Step 2 — Seed the initial tenant user
 *   Creates one record in the users collection from environment variables.
 *   Uses $os.getenv() — the documented PocketBase way to inject secrets
 *   into migrations without hardcoding them.
 *   Reference: https://pocketbase.io/docs/js-migrations/
 *   "Values can be loaded via $os.getenv(key) or from a special local config file"
 *
 *   `verified: true` is set programmatically because only a superuser context
 *   (which is what migrations run as) can set this field to true.
 *   This skips the email verification flow, appropriate for a seeded admin user.
 *   Reference: GitHub Discussion #3488 (maintainer ganigeorgiev):
 *   "Setting verified=true in createRule prevents public API creation since
 *    PocketBase has special handling for this field and only allows admins to set it."
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REQUIRED ENVIRONMENT VARIABLES
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   PB_USER_EMAIL      The business owner's login email for the CRM UI.
 *                      Example: owner@mibusiness.com
 *
 *   PB_USER_PASSWORD   The business owner's initial password.
 *                      Must be ≥ 8 characters (PocketBase minimum).
 *                      Generate: openssl rand -base64 16
 *
 * If these variables are not set, migration skips user creation and only
 * applies the security lockdown. The user can be created later via the
 * PocketBase admin panel at /_/ (accessible via Tailscale).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IDEMPOTENCY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The migration checks whether the user already exists before creating.
 * Safe to run multiple times — will not duplicate the user record.
 */

migrate((app) => {

    // ── Step 1: Lock self-registration ────────────────────────────────────────
    // Default PocketBase users collection has createRule="" (open registration).
    // For a single-tenant CRM, we must set it to null (superuser-only creation).
    // Docs: https://pocketbase.io/docs/api-rules-and-filters/
    const usersCollection = app.findCollectionByNameOrId("users");
    usersCollection.createRule = null; // "locked" — superuser only
    app.save(usersCollection);

    // ── Step 2: Seed initial tenant user ──────────────────────────────────────
    const email    = $os.getenv("PB_USER_EMAIL");
    const password = $os.getenv("PB_USER_PASSWORD");

    if (!email || !password) {
        // Skip seeding — user must be created manually via admin panel (/_/)
        // or by setting PB_USER_EMAIL and PB_USER_PASSWORD and re-running migrations.
        return;
    }

    // Idempotency: skip if the user already exists (e.g. container restart).
    try {
        app.findAuthRecordByEmail("users", email);
        return; // user already exists, nothing to do
    } catch (_) {
        // Not found — proceed with creation
    }

    const record = new Record(usersCollection);
    record.set("email",    email);
    record.set("password", password);
    // verified=true skips email confirmation. Only superuser context (migrations)
    // can set this field — prevents API abuse as documented by PocketBase maintainer.
    record.set("verified", true);

    app.save(record);

}, (app) => {

    // ── Down: restore open registration, delete seeded user ──────────────────
    const usersCollection = app.findCollectionByNameOrId("users");
    usersCollection.createRule = ""; // restore default open registration
    app.save(usersCollection);

    const email = $os.getenv("PB_USER_EMAIL");
    if (!email) return;

    try {
        const record = app.findAuthRecordByEmail("users", email);
        app.delete(record);
    } catch (_) {
        // Already deleted or never created — idempotent
    }

});
