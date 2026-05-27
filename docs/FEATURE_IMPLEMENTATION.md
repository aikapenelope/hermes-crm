# CRM Feature Implementation Guide
# PocketBase + SvelteKit 5 — Hermes CRM

This document covers every non-avatar UI feature added across Sprint 1 and
Sprint 2. Each section documents the PocketBase capability used, the exact
API call pattern, the migration (if any) and a reference to the SvelteKit
file that implements it.

Official PocketBase docs referenced: https://pocketbase.io/docs/

---

## Table of Contents

1. [Unified Contact Timeline](#1-unified-contact-timeline)
2. [Global Search](#2-global-search)
3. [Realtime Updates via Subscriptions](#3-realtime-updates-via-subscriptions)
4. [Quick Deal Stage Actions](#4-quick-deal-stage-actions)
5. [Tags — visible + filterable](#5-tags--visible--filterable)
6. [Company Detail Page](#6-company-detail-page)
7. [Drag-and-drop Deal Kanban](#7-drag-and-drop-deal-kanban)
8. [Revenue Forecast by Month](#8-revenue-forecast-by-month)
9. [Bulk Actions on Contacts](#9-bulk-actions-on-contacts)
10. [Note Attachments](#10-note-attachments)

---

## 1. Unified Contact Timeline

**File:** `ui/src/routes/(app)/contacts/[id]/+page.svelte`

### What it does
Replaces the separate Notes / Tasks / Deals sections in the contact detail
page with a single chronological feed showing every interaction in one
timeline: activities (calls, meetings, emails), notes, task completions,
deal stage changes — sorted by date descending.

### PocketBase API used
Four parallel `getList` calls, merged and sorted client-side:

```typescript
const [acts, notes, tasks, deals] = await Promise.all([
    pb.collection('activities').getList(1, 50, {
        filter: `contact='${contactId}'`,
        sort: '-date,-created',
        fields: 'id,type,title,description,date,created',
    }),
    pb.collection('notes').getList(1, 50, {
        filter: `contact='${contactId}'`,
        sort: '-created',
        fields: 'id,content,pinned,created',
    }),
    pb.collection('tasks').getList(1, 20, {
        filter: `contact='${contactId}'`,
        sort: '-created',
        fields: 'id,title,type,status,priority,due_date,created',
    }),
    pb.collection('deals').getList(1, 10, {
        filter: `contact='${contactId}'`,
        sort: '-created',
        fields: 'id,title,value,currency,stage,created',
    }),
]);

// Merge into timeline entries
const timeline = [
    ...acts.items.map(a => ({ kind: 'activity', ts: a.date || a.created, ...a })),
    ...notes.items.map(n => ({ kind: 'note', ts: n.created, ...n })),
    ...tasks.items.map(t => ({ kind: 'task', ts: t.created, ...t })),
    ...deals.items.map(d => ({ kind: 'deal', ts: d.created, ...d })),
].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
```

Docs reference: https://pocketbase.io/docs/api-records/ (List/Search Records)

### No migration needed
All required collections and fields already exist.
The `activities.date` field was added in migration 6.

---

## 2. Global Search

**File:** `ui/src/routes/(app)/+layout.svelte`
**Component:** `ui/src/lib/ui/GlobalSearch.svelte` (new)

### What it does
The search bar in the topbar is now functional. Typing 3+ characters
triggers a search across contacts, companies, deals, and tasks
simultaneously. Results appear as a dropdown grouped by type. Pressing
Enter or clicking navigates to the record.

### PocketBase API used
Four parallel `getList` calls with a `~` filter (case-insensitive contains):

```typescript
async function search(q: string) {
    if (q.length < 3) { results = null; return; }
    const esc = q.replace(/'/g, "\\'");
    const [contacts, companies, deals, tasks] = await Promise.all([
        pb.collection('contacts').getList(1, 4, {
            filter: `name~'${esc}' || email~'${esc}' || phone~'${esc}'`,
            fields: 'id,name,email,status',
        }),
        pb.collection('companies').getList(1, 3, {
            filter: `name~'${esc}'`,
            fields: 'id,name,industry',
        }),
        pb.collection('deals').getList(1, 4, {
            filter: `title~'${esc}'`,
            fields: 'id,title,stage,value,currency',
        }),
        pb.collection('tasks').getList(1, 3, {
            filter: `title~'${esc}'`,
            fields: 'id,title,status,priority',
        }),
    ]);
    results = { contacts: contacts.items, companies: companies.items,
                deals: deals.items, tasks: tasks.items };
}
```

The `~` operator in PocketBase filters is a case-insensitive LIKE %value%.
Docs reference: https://pocketbase.io/docs/api-rules-and-filters/
(section: Supported filter operators → `~`, `!~`)

### Debounce
Search fires 300ms after the last keypress to avoid flooding the API.

---

## 3. Realtime Updates via Subscriptions

**File:** `ui/src/routes/(app)/contacts/+page.svelte`
**File:** `ui/src/routes/(app)/tasks/+page.svelte`
**File:** `ui/src/routes/(app)/deals/+page.svelte`

### What it does
When Hermes (or another user) creates, updates or deletes a record while
the page is open, the UI updates immediately without a manual refresh.
Uses PocketBase Server-Sent Events (SSE) under the hood.

### PocketBase API used

```typescript
import { onDestroy } from 'svelte';

// Subscribe to all changes in the contacts collection
const unsubscribe = await pb.collection('contacts').subscribe('*', (e) => {
    if (e.action === 'create') {
        result = result
            ? { ...result, items: [e.record, ...result.items],
                totalItems: result.totalItems + 1 }
            : null;
    }
    if (e.action === 'update') {
        result = result
            ? { ...result, items: result.items.map(c =>
                c.id === e.record.id ? e.record : c) }
            : null;
    }
    if (e.action === 'delete') {
        result = result
            ? { ...result, items: result.items.filter(c => c.id !== e.record.id),
                totalItems: result.totalItems - 1 }
            : null;
    }
});

// IMPORTANT: always unsubscribe on component destroy
onDestroy(() => { unsubscribe(); });
```

Docs reference: https://pocketbase.io/docs/api-realtime/
The PocketBase JS SDK wraps the EventSource API. Each subscription opens
one SSE connection that stays alive as long as the component is mounted.

### PocketBase SDK subscribe signature
```typescript
// Subscribe to all records in a collection
pb.collection(name).subscribe('*', callback): Promise<UnsubscribeFunc>

// Subscribe to a specific record by ID
pb.collection(name).subscribe(recordId, callback): Promise<UnsubscribeFunc>
```

### No migration needed
Realtime is built into PocketBase for all base collections.

---

## 4. Quick Deal Stage Actions

**File:** `ui/src/routes/(app)/deals/+page.svelte`

### What it does
In both the list view and the Kanban view, each deal card has a stage
pill that opens a dropdown on click. Selecting a stage immediately updates
the deal without opening the edit sheet. Also adds one-click "Won" and
"Lost" buttons.

### PocketBase API used
Single field `PATCH` update — PocketBase ignores fields not included in
the body:

```typescript
async function setStage(dealId: string, newStage: string) {
    await pb.collection('deals').update(dealId, { stage: newStage });
    // Update local state immediately (optimistic UI)
    deals = deals.map(d => d.id === dealId ? { ...d, stage: newStage } : d);
}
```

Docs reference: https://pocketbase.io/docs/api-records/ (Update Record)
Any fields omitted from the PATCH body are left unchanged in PocketBase.

---

## 5. Tags — visible + filterable

**Files:**
- `ui/src/routes/(app)/contacts/+page.svelte`
- `ui/src/lib/forms/ContactForm.svelte`

### What it does
- Tags are displayed as badges on each contact row in the list
- A tag filter bar appears above the table: click a tag → filters the list
- The contact form gains a multi-select tag input (fetch tags, toggle)

### PocketBase API used

**Fetch tags for filter bar:**
```typescript
const tags = await pb.collection('tags').getFullList({
    sort: 'label', fields: 'id,label,color',
});
```

**Filter contacts by tag:**
```typescript
// PocketBase relation field filter: ~ means "contains" for multi-relations
const filter = selectedTagId
    ? `tags~'${selectedTagId}'`
    : undefined;
result = await pb.collection('contacts').getList(1, perPage, {
    filter,
    expand: 'tags',
    sort: '-created',
});
```

**Expand tags in contact records:**
```typescript
pb.collection('contacts').getList(1, 25, {
    expand: 'tags',  // returns full tag records inside expand.tags[]
    fields: 'id,name,email,status,tags,expand',
})
// Access: contact.expand?.tags → Tag[]
```

Docs reference:
- https://pocketbase.io/docs/api-rules-and-filters/ (~ operator for relations)
- https://pocketbase.io/docs/expanding-relations/ (expand parameter)

**Save tags from form:**
```typescript
// Tags is a RelationField with maxSelect: null (unlimited)
// Pass an array of tag IDs
await pb.collection('contacts').update(id, {
    tags: selectedTagIds,  // string[]
});
```

---

## 6. Company Detail Page

**New file:** `ui/src/routes/(app)/companies/[id]/+page.svelte`

### What it does
Clicking a company name now navigates to a full detail page showing:
- Company info (industry, size, website, city/country)
- All contacts linked to this company
- All deals linked to this company (direct or via contact)
- Total revenue (won deals) and pipeline value (open deals)

### PocketBase API used

```typescript
const companyId = $page.params.id;

const [company, contacts, deals] = await Promise.all([
    pb.collection('companies').getOne(companyId),

    pb.collection('contacts').getFullList({
        filter: `company='${companyId}'`,
        sort: 'name',
        fields: 'id,name,email,phone,status',
    }),

    pb.collection('deals').getFullList({
        filter: `company='${companyId}'`,
        sort: '-created',
        fields: 'id,title,value,currency,stage',
    }),
]);

// Compute stats client-side
const openPipeline = deals
    .filter(d => !['won','lost'].includes(d.stage))
    .reduce((s, d) => s + (d.value ?? 0), 0);

const wonRevenue = deals
    .filter(d => d.stage === 'won')
    .reduce((s, d) => s + (d.value ?? 0), 0);
```

No migration needed — `deals.company` RelationField already exists.

---

## 7. Drag-and-drop Deal Kanban

**File:** `ui/src/routes/(app)/deals/+page.svelte`

### What it does
In Kanban view, deal cards are draggable between stage columns using the
browser's native HTML5 Drag and Drop API. No external library required.

### Implementation — native HTML5 DnD

```svelte
<!-- Draggable card -->
<div
    draggable="true"
    ondragstart={(e) => {
        e.dataTransfer!.setData('dealId', deal.id);
        e.dataTransfer!.effectAllowed = 'move';
    }}
    class="..."
>
    {deal.title}
</div>

<!-- Drop target column -->
<div
    ondragover={(e) => { e.preventDefault(); e.dataTransfer!.dropEffect = 'move'; }}
    ondrop={(e) => {
        e.preventDefault();
        const dealId = e.dataTransfer!.getData('dealId');
        moveToStage(dealId, col.id);   // col.id = 'lead' | 'qualified' | etc.
    }}
    class="..."
>
    <!-- cards -->
</div>
```

PocketBase update on drop:
```typescript
async function moveToStage(dealId: string, stage: string) {
    await pb.collection('deals').update(dealId, { stage });
    allDeals = allDeals.map(d => d.id === dealId ? { ...d, stage } : d);
}
```

No migration needed. Uses the existing `deals.stage` SelectField.

---

## 8. Revenue Forecast by Month

**New file:** `ui/src/routes/(app)/deals/forecast/+page.svelte`
**Nav entry:** Added to sidebar under ANALYTICS // MGMT

### What it does
Shows all open deals grouped by `expected_close` month, with the total
pipeline value per month and a breakdown by stage. Helps predict when
revenue is expected to close.

### PocketBase API used

```typescript
// Fetch all open deals with expected_close date
const deals = await pb.collection('deals').getFullList({
    filter: "stage != 'won' && stage != 'lost' && expected_close != ''",
    sort: 'expected_close',
    fields: 'id,title,value,currency,stage,expected_close,probability',
});

// Group client-side by YYYY-MM
const byMonth: Record<string, { deals: Deal[], total: number }> = {};
for (const d of deals) {
    const month = d.expected_close.slice(0, 7); // '2026-06'
    if (!byMonth[month]) byMonth[month] = { deals: [], total: 0 };
    byMonth[month].deals.push(d);
    byMonth[month].total += d.value * (d.probability / 100);  // weighted
}
```

PocketBase does not have a native GROUP BY endpoint for records, but
`getFullList` with a targeted filter + client-side aggregation is the
correct pattern for this scale (< 10,000 records).

Docs reference: https://pocketbase.io/docs/api-records/ (List with filter)

---

## 9. Bulk Actions on Contacts

**File:** `ui/src/routes/(app)/contacts/+page.svelte`

### What it does
A checkbox column appears on each row. When contacts are selected:
- "Cambiar estado" → applies a new status to all selected
- "Asignar tag" → adds a tag to all selected
- "Exportar" → downloads a CSV of selected contacts

### PocketBase API used

PocketBase does not have a bulk-update endpoint. Bulk operations are done
with `Promise.all` over individual updates:

```typescript
async function bulkSetStatus(ids: string[], status: string) {
    await Promise.all(
        ids.map(id => pb.collection('contacts').update(id, { status }))
    );
    // Refresh list or update local state
    await fetchContacts();
}
```

For large selections (> 50), process in batches of 20 to avoid overwhelming:
```typescript
async function bulkUpdateBatched(ids: string[], data: object, batchSize = 20) {
    for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        await Promise.all(batch.map(id => pb.collection('contacts').update(id, data)));
    }
}
```

No migration needed.

---

## 10. Note Attachments

**Files:**
- `pb_migrations/7_notes_add_attachments.js` (migration)
- `ui/src/routes/(app)/contacts/[id]/+page.svelte` (file input in note form)

### Migration

Adds a `FileField` to the `notes` collection:

```javascript
// pb_migrations/7_notes_add_attachments.js
migrate((app) => {
    const col = app.findCollectionByNameOrId("notes");
    col.fields.push(new FileField({
        name:     "attachments",
        maxSelect: 5,
        maxSize:   5242880,  // 5MB per file
        mimeTypes: [
            "image/jpeg", "image/png", "image/webp",
            "application/pdf",
            "text/plain",
        ],
        thumbs: ["200x200"],  // for image previews
    }));
    app.save(col);
}, (app) => {
    const col = app.findCollectionByNameOrId("notes");
    col.fields.removeByName("attachments");
    app.save(col);
});
```

### PocketBase API — upload file with note

```typescript
async function saveNote(content: string, files: File[]) {
    const formData = new FormData();
    formData.append('content', content);
    formData.append('contact', contactId);
    files.forEach(f => formData.append('attachments', f));
    await pb.collection('notes').create(formData);
}
```

### Display attachments

```typescript
// Get file URL (for images, use thumb)
const url = pb.files.getUrl(note, filename, { thumb: '200x200' });

// All uploaded files are in note.attachments: string[]
// Each string is the filename (not full URL)
```

Docs reference: https://pocketbase.io/docs/files-handling/

---

## Sprint Plan

### Sprint 1 — Core UX improvements (no migrations)
| # | Feature | File(s) | Est. |
|---|---|---|---|
| 1 | Unified contact timeline | `contacts/[id]/+page.svelte` | 2h |
| 2 | Global search (header bar) | `+layout.svelte`, `GlobalSearch.svelte` | 2h |
| 3 | Realtime subscriptions | contacts, tasks, deals pages | 1h |
| 4 | Quick deal stage actions | `deals/+page.svelte` | 1h |
| 5 | Tags visible + filter | `contacts/+page.svelte`, `ContactForm.svelte` | 2h |

### Sprint 2 — New pages + data features (1 migration)
| # | Feature | File(s) | Est. |
|---|---|---|---|
| 6 | Company detail page | `companies/[id]/+page.svelte` (new) | 2h |
| 7 | Drag-and-drop Kanban | `deals/+page.svelte` | 1h |
| 8 | Revenue forecast | `deals/forecast/+page.svelte` (new) | 2h |
| 9 | Bulk actions on contacts | `contacts/+page.svelte` | 2h |
| 10 | Note attachments | migration 7 + `contacts/[id]` | 2h |

---

## PocketBase SDK Patterns — Quick Reference

```typescript
import pb from '$lib/pb';  // singleton PocketBase client

// --- CRUD ---
pb.collection('contacts').getList(page, perPage, { filter, sort, expand, fields })
pb.collection('contacts').getOne(id, { expand })
pb.collection('contacts').getFullList({ filter, sort, fields })   // no pagination
pb.collection('contacts').create(data)                            // data or FormData
pb.collection('contacts').update(id, data)                        // partial update
pb.collection('contacts').delete(id)

// --- File upload ---
const fd = new FormData();
fd.append('fieldName', fileObject);     // File or Blob
pb.collection('notes').create(fd);      // or .update(id, fd)
pb.files.getUrl(record, filename, { thumb: '200x200' })

// --- Realtime ---
const unsub = await pb.collection('contacts').subscribe('*', (e) => {
    // e.action: 'create' | 'update' | 'delete'
    // e.record: the affected record
});
unsub();  // call to unsubscribe

// --- Expand relations ---
pb.collection('contacts').getList(1, 25, { expand: 'company,tags' })
// Access: record.expand.company, record.expand.tags[]

// --- Filter operators ---
// =  !=  >  >=  <  <=     → comparison
// ~  !~                   → LIKE %value% (case-insensitive)
// &&  ||  !               → AND, OR, NOT
// @request.auth.id != ''  → authenticated user
// tags ~ 'TAG_ID'         → relation contains
```

Docs: https://pocketbase.io/docs/api-rules-and-filters/
