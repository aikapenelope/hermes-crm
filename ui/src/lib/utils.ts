/**
 * @file utils.ts
 * @description Shared utility functions for the Hermes CRM frontend.
 *
 * Security notice — PocketBase filter injection
 * ─────────────────────────────────────────────
 * PocketBase filter strings are evaluated server-side as expressions.
 * Directly interpolating user input (e.g. a search term) into a filter string
 * allows an attacker to break out of the string literal and inject arbitrary
 * filter logic, effectively leaking or enumerating records they shouldn't see.
 *
 * Example of the vulnerable pattern:
 *   filter: `name ~ '${search}'`          // ← DON'T do this with raw input
 *
 * Example attack payload in the search box:
 *   ' || '1'='1                           // → name ~ '' || '1'='1' (returns ALL)
 *
 * The official PocketBase docs state:
 *   "avoid directly interpolating untrusted user input into rule strings"
 *   https://pocketbase.io/docs/api-rules-and-filters/
 *
 * Always pass user-supplied text through `sanitizeFilter` before interpolating.
 */

/**
 * Escapes a user-supplied string for safe interpolation inside a PocketBase
 * single-quoted filter literal.
 *
 * Characters escaped:
 *   `\`  → `\\`   (must come first to avoid double-escaping)
 *   `'`  → `\'`   (string delimiter in PB filter syntax)
 *
 * Usage:
 *   import { sanitizeFilter } from '$lib/utils';
 *   const safe = sanitizeFilter(userInput);
 *   filter: `name ~ '${safe}' || email ~ '${safe}'`
 *
 * @param input - Raw user-supplied string (e.g. from a search <input>).
 * @returns     - Escaped string safe to embed inside single quotes in a PB filter.
 */
export function sanitizeFilter(input: string): string {
	return input
		.replace(/\\/g, '\\\\') // escape backslashes first
		.replace(/'/g, "\\'"); // then escape single quotes
}

/**
 * Trims whitespace and applies filter sanitization in one step.
 * Convenience wrapper for search inputs that always need both operations.
 *
 * @param input - Raw search string.
 * @returns     - Trimmed, filter-safe string.
 */
export function sanitizeSearch(input: string): string {
	return sanitizeFilter(input.trim());
}
