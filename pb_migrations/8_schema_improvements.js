/// <reference path="../pb_data/types.d.ts" />
/**
 * Migration 8 — Schema improvements: contacts fields + goals progress
 *
 * contacts:
 *   source SelectField — adds 'import' and 'csv' to allowed values
 *   whatsapp BoolField — is this phone number on WhatsApp?
 *   city / country TextField — geographic segmentation
 *   birthday DateField — for reminders and personalized follow-ups
 *
 * goals:
 *   current NumberField — actual value achieved toward the target
 *   notes TextField — context and observations about progress
 *
 * NOTE: In PocketBase v0.38, JS migrations may not auto-create SQLite
 * columns. If deploying to an existing instance, apply ALTER TABLE
 * manually (see docs/KNOWN_ISSUES.md). Fresh installs get the columns.
 */

migrate((app) => {

    // ── contacts ──────────────────────────────────────────────────────────────
    var contacts = app.findCollectionByNameOrId("contacts");
    var contactsChanged = false;

    // Add 'import' and 'csv' to source SelectField
    try {
        var sourceField = contacts.fields.getByName("source");
        if (sourceField && sourceField.values) {
            var vals = sourceField.values;
            var added = false;
            ["import", "csv"].forEach(function(v) {
                if (vals.indexOf(v) === -1) { vals.push(v); added = true; }
            });
            if (added) {
                sourceField.values = vals;
                contactsChanged = true;
            }
        }
    } catch(e) {}

    // whatsapp
    try { contacts.fields.getByName("whatsapp"); } catch(e) {
        contacts.fields.push(new BoolField({ name: "whatsapp" }));
        contactsChanged = true;
    }

    // city
    try { contacts.fields.getByName("city"); } catch(e) {
        contacts.fields.push(new TextField({ name: "city" }));
        contactsChanged = true;
    }

    // country
    try { contacts.fields.getByName("country"); } catch(e) {
        contacts.fields.push(new TextField({ name: "country" }));
        contactsChanged = true;
    }

    // birthday
    try { contacts.fields.getByName("birthday"); } catch(e) {
        contacts.fields.push(new DateField({ name: "birthday" }));
        contactsChanged = true;
    }

    if (contactsChanged) { app.save(contacts); }

    // ── goals ─────────────────────────────────────────────────────────────────
    var goals = app.findCollectionByNameOrId("goals");
    var goalsChanged = false;

    // current
    try { goals.fields.getByName("current"); } catch(e) {
        goals.fields.push(new NumberField({ name: "current", min: 0 }));
        goalsChanged = true;
    }

    // notes
    try { goals.fields.getByName("notes"); } catch(e) {
        goals.fields.push(new TextField({ name: "notes" }));
        goalsChanged = true;
    }

    if (goalsChanged) { app.save(goals); }

}, (app) => {

    try {
        var contacts = app.findCollectionByNameOrId("contacts");
        var changed = false;
        ["whatsapp", "city", "country", "birthday"].forEach(function(f) {
            try { contacts.fields.removeByName(f); changed = true; } catch(e) {}
        });
        try {
            var src = contacts.fields.getByName("source");
            if (src && src.values) {
                src.values = src.values.filter(function(v) { return v !== "import" && v !== "csv"; });
                changed = true;
            }
        } catch(e) {}
        if (changed) { app.save(contacts); }
    } catch(e) {}

    try {
        var goals = app.findCollectionByNameOrId("goals");
        var changed2 = false;
        ["current", "notes"].forEach(function(f) {
            try { goals.fields.removeByName(f); changed2 = true; } catch(e) {}
        });
        if (changed2) { app.save(goals); }
    } catch(e) {}

});
