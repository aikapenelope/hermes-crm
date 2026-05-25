/// <reference path="../pb_data/types.d.ts" />
/**
 * QYNE CRM — Initial schema migration (PocketBase v0.22+)
 *
 * IMPORTANT: In PocketBase v0.22+, fields MUST be added via col.fields.push()
 * AFTER the Collection is constructed. Passing fields in the constructor
 * { fields: [...] } does NOT work — fields are silently ignored.
 *
 * Correct pattern:
 *   const col = new Collection({ name: "...", type: "base", ...rules });
 *   col.fields.push(new TextField({ name: "title" }));
 *   app.save(col);
 */

const AUTH = "@request.auth.id != \"\"";

migrate((app) => {

    // =========================================================================
    // 1. TAGS
    // =========================================================================
    const tags = new Collection({
        name: "tags", type: "base",
        listRule: AUTH, viewRule: AUTH, createRule: AUTH, updateRule: AUTH, deleteRule: AUTH,
    });
    tags.fields.push(new TextField({ name: "label", required: true }));
    tags.fields.push(new TextField({ name: "color" }));
    app.save(tags);

    // =========================================================================
    // 2. COMPANIES
    // =========================================================================
    const companies = new Collection({
        name: "companies", type: "base",
        listRule: AUTH, viewRule: AUTH, createRule: AUTH, updateRule: AUTH, deleteRule: AUTH,
    });
    companies.fields.push(new TextField({ name: "name", required: true }));
    companies.fields.push(new SelectField({
        name: "industry", maxSelect: 1,
        values: ["technology","finance","healthcare","retail","manufacturing",
                 "education","real_estate","hospitality","consulting","other"],
    }));
    companies.fields.push(new URLField({ name: "website" }));
    companies.fields.push(new TextField({ name: "city" }));
    companies.fields.push(new TextField({ name: "country" }));
    companies.fields.push(new SelectField({
        name: "size", maxSelect: 1,
        values: ["1-10","11-50","51-200","201-500","500+"],
    }));
    companies.fields.push(new FileField({
        name: "logo", maxSelect: 1, maxSize: 2097152,
        mimeTypes: ["image/jpeg","image/png","image/webp","image/svg+xml"],
        thumbs: ["64x64"],
    }));
    companies.fields.push(new TextField({ name: "notes" }));
    app.save(companies);

    // =========================================================================
    // 3. PIPELINES
    // =========================================================================
    const pipelines = new Collection({
        name: "pipelines", type: "base",
        listRule: AUTH, viewRule: AUTH, createRule: AUTH, updateRule: AUTH, deleteRule: AUTH,
    });
    pipelines.fields.push(new TextField({ name: "name", required: true }));
    pipelines.fields.push(new JSONField({ name: "stages", maxSize: 50000 }));
    pipelines.fields.push(new BoolField({ name: "is_default" }));
    app.save(pipelines);

    // Seed the default Sales Pipeline
    const defaultPipeline = new Record(pipelines);
    defaultPipeline.set("name", "Sales Pipeline");
    defaultPipeline.set("is_default", true);
    defaultPipeline.set("stages", [
        { id: "lead",        label: "Lead",        color: "#6B7280", order: 0 },
        { id: "qualified",   label: "Qualified",   color: "#3B82F6", order: 1 },
        { id: "proposal",    label: "Proposal",    color: "#F59E0B", order: 2 },
        { id: "negotiation", label: "Negotiation", color: "#EF4444", order: 3 },
        { id: "won",         label: "Won",         color: "#10B981", order: 4 },
        { id: "lost",        label: "Lost",        color: "#9CA3AF", order: 5 },
    ]);
    app.save(defaultPipeline);

    // =========================================================================
    // 4. CONTACTS
    // =========================================================================
    const usersId     = app.findCollectionByNameOrId("users").id;
    const companiesId = companies.id;
    const tagsId      = tags.id;

    const contacts = new Collection({
        name: "contacts", type: "base",
        listRule: AUTH, viewRule: AUTH, createRule: AUTH, updateRule: AUTH, deleteRule: AUTH,
    });
    contacts.fields.push(new TextField({ name: "name",  required: true }));
    contacts.fields.push(new EmailField({ name: "email" }));
    contacts.fields.push(new TextField({ name: "phone" }));
    contacts.fields.push(new RelationField({
        name: "company", collectionId: companiesId, cascadeDelete: false, maxSelect: 1,
    }));
    contacts.fields.push(new SelectField({
        name: "status", maxSelect: 1,
        values: ["lead","prospect","customer","churned","inactive"],
    }));
    contacts.fields.push(new SelectField({
        name: "source", maxSelect: 1,
        values: ["manual","whatsapp","instagram","web","referral","email","other"],
    }));
    contacts.fields.push(new RelationField({
        name: "tags", collectionId: tagsId, cascadeDelete: false, maxSelect: null,
    }));
    contacts.fields.push(new RelationField({
        name: "owner", collectionId: usersId, cascadeDelete: false, maxSelect: 1,
    }));
    contacts.fields.push(new FileField({
        name: "avatar", maxSelect: 1, maxSize: 2097152,
        mimeTypes: ["image/jpeg","image/png","image/webp"],
        thumbs: ["80x80"],
    }));
    contacts.fields.push(new DateField({ name: "last_contacted" }));
    contacts.fields.push(new URLField({ name: "linkedin" }));
    contacts.fields.push(new URLField({ name: "twitter" }));
    contacts.fields.push(new TextField({ name: "notes" }));
    app.save(contacts);

    // =========================================================================
    // 5. DEALS
    // =========================================================================
    const contactsId  = contacts.id;
    const pipelinesId = pipelines.id;

    const deals = new Collection({
        name: "deals", type: "base",
        listRule: AUTH, viewRule: AUTH, createRule: AUTH, updateRule: AUTH, deleteRule: AUTH,
    });
    deals.fields.push(new TextField({ name: "title", required: true }));
    deals.fields.push(new NumberField({ name: "value", min: 0 }));
    deals.fields.push(new SelectField({
        name: "currency", maxSelect: 1,
        values: ["USD","COP","EUR","MXN","BRL","ARS"],
    }));
    deals.fields.push(new SelectField({
        name: "stage", maxSelect: 1,
        values: ["lead","qualified","proposal","negotiation","won","lost"],
    }));
    deals.fields.push(new NumberField({ name: "probability", min: 0, max: 100, noDecimal: true }));
    deals.fields.push(new DateField({ name: "expected_close" }));
    deals.fields.push(new RelationField({
        name: "contact", collectionId: contactsId, cascadeDelete: false, maxSelect: 1,
    }));
    deals.fields.push(new RelationField({
        name: "company", collectionId: companiesId, cascadeDelete: false, maxSelect: 1,
    }));
    deals.fields.push(new RelationField({
        name: "pipeline", collectionId: pipelinesId, cascadeDelete: false, maxSelect: 1,
    }));
    deals.fields.push(new RelationField({
        name: "owner", collectionId: usersId, cascadeDelete: false, maxSelect: 1,
    }));
    deals.fields.push(new TextField({ name: "description" }));
    app.save(deals);

    // =========================================================================
    // 6. TASKS
    // =========================================================================
    const dealsId = deals.id;

    const tasks = new Collection({
        name: "tasks", type: "base",
        listRule: AUTH, viewRule: AUTH, createRule: AUTH, updateRule: AUTH, deleteRule: AUTH,
    });
    tasks.fields.push(new TextField({ name: "title", required: true }));
    tasks.fields.push(new SelectField({
        name: "type", maxSelect: 1,
        values: ["call","email","meeting","demo","task","follow_up"],
    }));
    tasks.fields.push(new SelectField({
        name: "status", maxSelect: 1,
        values: ["todo","in_progress","done","cancelled"],
    }));
    tasks.fields.push(new SelectField({
        name: "priority", maxSelect: 1,
        values: ["low","medium","high","urgent"],
    }));
    tasks.fields.push(new DateField({ name: "due_date" }));
    tasks.fields.push(new RelationField({
        name: "contact", collectionId: contactsId, cascadeDelete: false, maxSelect: 1,
    }));
    tasks.fields.push(new RelationField({
        name: "deal", collectionId: dealsId, cascadeDelete: false, maxSelect: 1,
    }));
    tasks.fields.push(new RelationField({
        name: "assigned_to", collectionId: usersId, cascadeDelete: false, maxSelect: 1,
    }));
    tasks.fields.push(new TextField({ name: "description" }));
    app.save(tasks);

    // =========================================================================
    // 7. ACTIVITIES (immutable log)
    // =========================================================================
    const activities = new Collection({
        name: "activities", type: "base",
        listRule: AUTH, viewRule: AUTH,
        createRule: AUTH,
        updateRule: null,
        deleteRule: null,
    });
    activities.fields.push(new SelectField({
        name: "type", maxSelect: 1,
        values: ["note","call","email","meeting","stage_change",
                 "deal_created","task_done","contact_created"],
    }));
    activities.fields.push(new TextField({ name: "description" }));
    activities.fields.push(new RelationField({
        name: "contact", collectionId: contactsId, cascadeDelete: false, maxSelect: 1,
    }));
    activities.fields.push(new RelationField({
        name: "deal", collectionId: dealsId, cascadeDelete: false, maxSelect: 1,
    }));
    activities.fields.push(new RelationField({
        name: "created_by", collectionId: usersId, cascadeDelete: false, maxSelect: 1,
    }));
    activities.fields.push(new JSONField({ name: "metadata", maxSize: 10000 }));
    app.save(activities);

    // =========================================================================
    // 8. NOTES
    // =========================================================================
    const notes = new Collection({
        name: "notes", type: "base",
        listRule: AUTH, viewRule: AUTH, createRule: AUTH, updateRule: AUTH, deleteRule: AUTH,
    });
    notes.fields.push(new TextField({ name: "content", required: true }));
    notes.fields.push(new RelationField({
        name: "contact", collectionId: contactsId, cascadeDelete: false, maxSelect: 1,
    }));
    notes.fields.push(new RelationField({
        name: "deal", collectionId: dealsId, cascadeDelete: false, maxSelect: 1,
    }));
    notes.fields.push(new RelationField({
        name: "created_by", collectionId: usersId, cascadeDelete: false, maxSelect: 1,
    }));
    notes.fields.push(new BoolField({ name: "pinned" }));
    app.save(notes);

    // =========================================================================
    // 9. PRODUCTS
    // =========================================================================
    const products = new Collection({
        name: "products", type: "base",
        listRule: AUTH, viewRule: AUTH, createRule: AUTH, updateRule: AUTH, deleteRule: AUTH,
    });
    products.fields.push(new TextField({ name: "name", required: true }));
    products.fields.push(new TextField({ name: "sku" }));
    products.fields.push(new SelectField({
        name: "type", maxSelect: 1,
        values: ["product","service","subscription","license"],
    }));
    products.fields.push(new TextField({ name: "description" }));
    products.fields.push(new NumberField({ name: "price", min: 0 }));
    products.fields.push(new SelectField({
        name: "currency", maxSelect: 1,
        values: ["USD","COP","EUR","MXN","BRL","ARS"],
    }));
    products.fields.push(new BoolField({ name: "active" }));
    app.save(products);

    // =========================================================================
    // 10. DEAL_ITEMS
    // =========================================================================
    const deal_items = new Collection({
        name: "deal_items", type: "base",
        listRule: AUTH, viewRule: AUTH, createRule: AUTH, updateRule: AUTH, deleteRule: AUTH,
    });
    deal_items.fields.push(new RelationField({
        name: "deal", collectionId: dealsId, cascadeDelete: true, maxSelect: 1,
    }));
    deal_items.fields.push(new RelationField({
        name: "product", collectionId: products.id, cascadeDelete: false, maxSelect: 1,
    }));
    deal_items.fields.push(new NumberField({ name: "qty", min: 0 }));
    deal_items.fields.push(new NumberField({ name: "unit_price", min: 0 }));
    deal_items.fields.push(new TextField({ name: "notes" }));
    app.save(deal_items);

    // =========================================================================
    // 11. GOALS
    // =========================================================================
    const goals = new Collection({
        name: "goals", type: "base",
        listRule: AUTH, viewRule: AUTH, createRule: AUTH, updateRule: AUTH, deleteRule: AUTH,
    });
    goals.fields.push(new SelectField({
        name: "metric", maxSelect: 1,
        values: ["deals_won_count","deals_won_value","new_contacts","new_deals","activities_done"],
    }));
    goals.fields.push(new NumberField({ name: "target", min: 0 }));
    goals.fields.push(new SelectField({
        name: "currency", maxSelect: 1,
        values: ["USD","COP","EUR","MXN","BRL","ARS"],
    }));
    goals.fields.push(new TextField({ name: "period", required: true }));
    goals.fields.push(new RelationField({
        name: "owner", collectionId: usersId, cascadeDelete: false, maxSelect: 1,
    }));
    app.save(goals);

    // =========================================================================
    // 12. SEGMENT VIEWS (live SQL queries — read-only)
    // =========================================================================

    const seg_hot = new Collection({
        name: "seg_hot_leads", type: "view",
        listRule: AUTH, viewRule: AUTH,
        viewQuery: `
            SELECT DISTINCT
                c.id, c.name, c.email, c.phone, c.status,
                d.id          AS deal_id,
                d.title       AS deal_title,
                d.value       AS deal_value,
                d.stage       AS deal_stage,
                d.expected_close
            FROM contacts c
            JOIN deals d ON d.contact = c.id
            WHERE d.stage IN ('proposal','negotiation')
        `,
    });
    app.save(seg_hot);

    const seg_risk = new Collection({
        name: "seg_pipeline_at_risk", type: "view",
        listRule: AUTH, viewRule: AUTH,
        viewQuery: `
            SELECT
                d.id, d.title, d.value, d.currency, d.stage,
                d.expected_close, d.contact, d.company, d.owner,
                CAST(julianday('now') - julianday(d.expected_close) AS INTEGER) AS days_overdue
            FROM deals d
            WHERE d.expected_close < date('now')
              AND d.stage NOT IN ('won','lost')
            ORDER BY days_overdue DESC
        `,
    });
    app.save(seg_risk);

    // seg_cold_contacts: no complex expressions (CASE WHEN not supported by PB parser).
    // days_since_contact is calculated client-side from last_contacted.
    const seg_cold = new Collection({
        name: "seg_cold_contacts", type: "view",
        listRule: AUTH, viewRule: AUTH,
        viewQuery: `
            SELECT DISTINCT
                c.id, c.name, c.email, c.phone,
                c.last_contacted, c.owner
            FROM contacts c
            JOIN deals d ON d.contact = c.id
            WHERE d.stage NOT IN ('won','lost')
              AND (
                  c.last_contacted < datetime('now','-30 days')
                  OR c.last_contacted = ''
                  OR c.last_contacted IS NULL
              )
        `,
    });
    app.save(seg_cold);

    const seg_rev = new Collection({
        name: "seg_revenue_by_source", type: "view",
        listRule: AUTH, viewRule: AUTH,
        viewQuery: `
            SELECT
                c.source AS id,
                c.source,
                COUNT(DISTINCT c.id) AS total_contacts,
                COUNT(DISTINCT d.id) AS total_deals,
                COALESCE(SUM(CASE WHEN d.stage='won' THEN d.value ELSE 0 END), 0) AS revenue_won,
                COUNT(CASE WHEN d.stage='won' THEN 1 END) AS deals_won
            FROM contacts c
            LEFT JOIN deals d ON d.contact = c.id
            WHERE c.source IS NOT NULL AND c.source != ''
            GROUP BY c.source
            ORDER BY revenue_won DESC
        `,
    });
    app.save(seg_rev);

    const seg_own = new Collection({
        name: "seg_won_by_owner", type: "view",
        listRule: AUTH, viewRule: AUTH,
        viewQuery: `
            SELECT
                u.id,
                u.name  AS owner_name,
                u.email AS owner_email,
                COUNT(DISTINCT d.id)      AS deals_won,
                COALESCE(SUM(d.value), 0) AS revenue_won,
                COUNT(DISTINCT c.id)      AS contacts_owned
            FROM users u
            LEFT JOIN deals d ON d.owner = u.id AND d.stage = 'won'
            LEFT JOIN contacts c ON c.owner = u.id
            GROUP BY u.id
            ORDER BY revenue_won DESC
        `,
    });
    app.save(seg_own);

    // =========================================================================
    // 13. CONVERSATIONS (immutable message log per contact/channel)
    // =========================================================================
    // Written by Hermes post-hook (0 tokens) after every inbound/outbound msg.
    // Never updated or deleted — append-only audit trail.
    const conversations = new Collection({
        name: "conversations", type: "base",
        listRule: AUTH, viewRule: AUTH,
        createRule: AUTH,
        updateRule: null,
        deleteRule: null,
    });
    conversations.fields.push(new RelationField({
        name: "contact", collectionId: contactsId, cascadeDelete: false, maxSelect: 1,
    }));
    conversations.fields.push(new SelectField({
        name: "channel", maxSelect: 1,
        values: ["whatsapp", "telegram", "email", "web"],
    }));
    conversations.fields.push(new SelectField({
        name: "direction", maxSelect: 1,
        values: ["inbound", "outbound"],
    }));
    conversations.fields.push(new TextField({ name: "content", required: true }));
    conversations.fields.push(new TextField({ name: "session_id" }));
    conversations.fields.push(new TextField({ name: "hermes_agent_id" }));
    app.save(conversations);

}, (app) => {
    for (const name of [
        "seg_won_by_owner","seg_revenue_by_source","seg_cold_contacts",
        "seg_pipeline_at_risk","seg_hot_leads",
        "goals","deal_items","products","notes","activities",
        "tasks","deals","contacts","pipelines","companies","tags",
        "conversations",
    ]) {
        try { app.delete(app.findCollectionByNameOrId(name)); } catch(_) {}
    }
});
