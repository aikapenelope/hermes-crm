/// <reference path="../pb_data/types.d.ts" />
/**
 * Migration 4 — Add email_log and reports collections
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * email_log
 * ─────────────────────────────────────────────────────────────────────────────
 * Stores incoming and outgoing email metadata: subject line, sender, date.
 * Written by Hermes automatically via the crm-gmail-sync skill (see
 * hermes-config/skills/crm-gmail-sync/SKILL.md).
 *
 * Design decisions:
 * - Read-only in the CRM UI (no create/update/delete forms shown to the user)
 * - createRule: AUTH — Hermes (as a superuser) can write; the UI user can read
 * - updateRule: null — immutable once written (email log is an audit trail)
 * - deleteRule: null — prevents accidental deletion
 * - thread_id field: used by the skill for deduplication (skip if already logged)
 * - No relation to contacts: purely informational as requested
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * reports
 * ─────────────────────────────────────────────────────────────────────────────
 * Stores summaries from Hermes automated tasks: cron jobs, research runs,
 * content plans, and any other autonomous agent output worth preserving.
 *
 * Written by Hermes via MCP after completing a scheduled or ad-hoc task.
 * The SOUL.md for each tenant should include: "after each cron job or
 * significant automated task, save a summary to the reports collection
 * via the crm MCP server."
 *
 * Design decisions:
 * - createRule: AUTH — Hermes writes; the UI user can read
 * - updateRule: AUTH — Hermes can amend its own reports (status updates)
 * - deleteRule: null — reports are permanent records
 * - type field distinguishes automated (cron) from manual (hermes) from
 *   email-related (email_summary) reports
 */

const AUTH = "@request.auth.id != \"\"";

migrate((app) => {

    // ── email_log ─────────────────────────────────────────────────────────────
    const emailLog = new Collection({
        name: "email_log", type: "base",
        listRule:   AUTH,
        viewRule:   AUTH,
        createRule: AUTH,
        updateRule: null, // immutable — email history is append-only
        deleteRule: null,
    });

    // Subject line — the primary display field
    emailLog.fields.push(new TextField({
        name:     "subject",
        required: true,
    }));

    // Sender email address
    emailLog.fields.push(new EmailField({
        name:     "sender",
        required: true,
    }));

    // Sender display name (e.g. "Juan Pérez" <juan@empresa.com>)
    emailLog.fields.push(new TextField({
        name: "sender_name",
    }));

    // When the email was received (set by the skill, not by PB auto-date)
    emailLog.fields.push(new DateField({
        name:     "received",
        required: true,
    }));

    // Email direction — most entries will be "inbound" but outbound (sent)
    // can also be captured for a complete picture
    emailLog.fields.push(new SelectField({
        name:      "direction",
        maxSelect: 1,
        values:    ["inbound", "outbound"],
    }));

    // Gmail thread / message ID — used by the sync skill for deduplication
    // so the same email is never written twice
    emailLog.fields.push(new TextField({
        name: "thread_id",
    }));

    app.save(emailLog);


    // ── reports ──────────────────────────────────────────────────────────────
    const reports = new Collection({
        name: "reports", type: "base",
        listRule:   AUTH,
        viewRule:   AUTH,
        createRule: AUTH,
        updateRule: AUTH, // Hermes can update status/content after writing
        deleteRule: null,
    });

    // Short title shown in the list view
    // Examples: "Reporte semanal contenido — 26 may", "Análisis leads Q2"
    reports.fields.push(new TextField({
        name:     "title",
        required: true,
    }));

    // Full report body — markdown supported, rendered in the CRM detail view
    reports.fields.push(new TextField({
        name: "content",
    }));

    // Report origin:
    //   cron          — triggered by a Hermes scheduled job
    //   manual        — triggered by the user asking Hermes to do something
    //   email_summary — produced by the crm-gmail-sync skill
    //   hermes        — any other autonomous Hermes output
    reports.fields.push(new SelectField({
        name:      "type",
        maxSelect: 1,
        values:    ["cron", "manual", "email_summary", "hermes"],
    }));

    // Outcome of the automated task
    reports.fields.push(new SelectField({
        name:      "status",
        maxSelect: 1,
        values:    ["success", "info", "warning", "error"],
    }));

    // Hermes session ID — links back to the conversation/run that produced it
    reports.fields.push(new TextField({
        name: "session_id",
    }));

    app.save(reports);

}, (app) => {
    for (const name of ["reports", "email_log"]) {
        try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
    }
});
