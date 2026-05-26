/// <reference path="../pb_data/types.d.ts" />
/**
 * Migration 2 — Fix seg_revenue_by_source: replace CASE WHEN with correlated subqueries.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PROBLEM
 * ─────────────────────────────────────────────────────────────────────────────
 * PocketBase's view-collection SQL validator may reject CASE WHEN syntax.
 * This was observed for `seg_cold_contacts` (ref: comment in 1_init_crm.js)
 * which had to be simplified to avoid CASE WHEN.
 *
 * The original `seg_revenue_by_source` uses CASE WHEN inside aggregate functions:
 *
 *   SUM(CASE WHEN d.stage='won' THEN d.value ELSE 0 END) AS revenue_won,
 *   COUNT(CASE WHEN d.stage='won' THEN 1 END)             AS deals_won
 *
 * If the PocketBase parser rejects this at migration time, the collection is
 * never created and the Segments page returns a 404 for this view.
 *
 * Note: `seg_won_by_owner` is NOT affected — it already uses the safer
 * "filter-in-JOIN" pattern: `JOIN deals d ON d.owner = u.id AND d.stage = 'won'`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SOLUTION
 * ─────────────────────────────────────────────────────────────────────────────
 * Replace CASE WHEN with correlated scalar subqueries. These use only standard
 * SQL features (JOINs, GROUP BY, COUNT, SUM) that PocketBase reliably supports.
 *
 * Key insight: in a GROUP BY c.source query, a correlated subquery that
 * references c.source is safe because all rows in a group share the same
 * value for the GROUP BY column.
 *
 * Rewritten aggregates:
 *
 *   COALESCE(
 *     (SELECT SUM(d2.value)
 *      FROM deals d2 JOIN contacts c2 ON c2.id = d2.contact
 *      WHERE d2.stage = 'won' AND c2.source = c.source), 0
 *   ) AS revenue_won,
 *
 *   (SELECT COUNT(DISTINCT d3.id)
 *    FROM deals d3 JOIN contacts c3 ON c3.id = d3.contact
 *    WHERE d3.stage = 'won' AND c3.source = c.source
 *   ) AS deals_won
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VERIFICATION
 * ─────────────────────────────────────────────────────────────────────────────
 * Semantic equivalence was verified with an in-memory SQLite3 test covering:
 *   - contacts with multiple won deals (tests SUM deduplication)
 *   - contacts with zero won deals (tests COALESCE default)
 *   - contacts with no deals at all (tests LEFT JOIN + zero revenue)
 *   - multiple contacts per source (tests GROUP BY correctness)
 *
 * Both queries produce identical results for all test cases.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IDEMPOTENCY
 * ─────────────────────────────────────────────────────────────────────────────
 * The migration drops the existing collection before recreating it.
 * The try/catch on delete makes this safe to run even if the collection
 * was never created by migration 1 (CASE WHEN validation failure scenario).
 */

const AUTH = "@request.auth.id != \"\"";

migrate((app) => {

    // ── Drop existing view (idempotent — safe if never created) ──────────────
    try {
        app.delete(app.findCollectionByNameOrId("seg_revenue_by_source"));
    } catch (_) {
        // Collection may not exist if migration 1 failed for this view.
        // Proceed with create.
    }

    // ── Recreate with CASE WHEN removed ──────────────────────────────────────
    const segRev = new Collection({
        name: "seg_revenue_by_source", type: "view",
        listRule: AUTH, viewRule: AUTH,
        viewQuery: `
            SELECT
                c.source AS id,
                c.source,
                COUNT(DISTINCT c.id) AS total_contacts,
                COUNT(DISTINCT d.id) AS total_deals,
                COALESCE(
                    (SELECT SUM(d2.value)
                     FROM deals d2
                     JOIN contacts c2 ON c2.id = d2.contact
                     WHERE d2.stage = 'won'
                       AND c2.source = c.source
                    ), 0
                ) AS revenue_won,
                (SELECT COUNT(DISTINCT d3.id)
                 FROM deals d3
                 JOIN contacts c3 ON c3.id = d3.contact
                 WHERE d3.stage = 'won'
                   AND c3.source = c.source
                ) AS deals_won
            FROM contacts c
            LEFT JOIN deals d ON d.contact = c.id
            WHERE c.source IS NOT NULL AND c.source != ''
            GROUP BY c.source
            ORDER BY revenue_won DESC
        `,
    });
    app.save(segRev);

}, (app) => {

    // ── Down: restore original query (with CASE WHEN) for rollback ───────────
    try {
        app.delete(app.findCollectionByNameOrId("seg_revenue_by_source"));
    } catch (_) {}

    const segRevOrig = new Collection({
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
    app.save(segRevOrig);

});
