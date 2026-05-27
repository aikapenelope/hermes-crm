/// <reference path="../pb_data/types.d.ts" />
/**
 * Migration 7 — Add attachments FileField to notes collection
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IT DOES
 * ─────────────────────────────────────────────────────────────────────────────
 * Allows users and Hermes to attach files (images, PDFs, plain text) to notes.
 * Up to 5 files per note, max 5MB each.
 *
 * The UI shows:
 *   - A file input in the note creation form (contacts/[id] page)
 *   - Thumbnail previews for images (PocketBase generates them automatically)
 *   - PDF/text links for non-image files
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POCKETBASE FILE API
 * ─────────────────────────────────────────────────────────────────────────────
 * Uploading via JS SDK (must use FormData, not JSON):
 *
 *   const fd = new FormData();
 *   fd.append('content', 'note text');
 *   fd.append('contact', contactId);
 *   fd.append('attachments', fileObject);   // File or Blob
 *   await pb.collection('notes').create(fd);
 *
 * Getting file URL:
 *   pb.files.getUrl(record, filename, { thumb: '200x200' })
 *
 * Docs: https://pocketbase.io/docs/files-handling/
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IDEMPOTENCY
 * ─────────────────────────────────────────────────────────────────────────────
 * getByName() is used to check before adding. Safe to run multiple times.
 *
 * NOTE: In PocketBase v0.38, JS migrations do NOT automatically create the
 * physical SQLite column. After this migration runs, the ALTER TABLE approach
 * must be applied manually if deploying to an existing instance that predates
 * this migration. Fresh installs from this image will have the column.
 */

migrate((app) => {

    const col = app.findCollectionByNameOrId("notes");

    try {
        col.fields.getByName("attachments");
        // Field already exists — idempotent
    } catch (_) {
        col.fields.push(new FileField({
            name:      "attachments",
            maxSelect: 5,
            maxSize:   5242880,  // 5 MB per file
            mimeTypes: [
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/gif",
                "application/pdf",
                "text/plain",
            ],
            thumbs: ["200x200"],  // PocketBase auto-generates thumbnails for images
        }));
        app.save(col);
    }

}, (app) => {
    const col = app.findCollectionByNameOrId("notes");
    try {
        col.fields.removeByName("attachments");
        app.save(col);
    } catch (_) {}
});
