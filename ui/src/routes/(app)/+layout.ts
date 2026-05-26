import { browser } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import pb from '$lib/pb';

/**
 * Auth guard for all (app) routes.
 * Runs on the client (ssr=false).
 *
 * Two-layer token validation:
 *
 * Layer 1 — Local (synchronous, zero network):
 *   pb.authStore.isValid checks the JWT `exp` claim stored in localStorage.
 *   If the token is expired or absent, redirect to /login immediately.
 *
 * Layer 2 — Server (async, one network round-trip):
 *   authRefresh() re-validates the token against the PocketBase server and
 *   returns a fresh token with updated user data. This catches tokens that
 *   are locally valid but were revoked server-side (e.g. password change,
 *   superuser-forced logout, or manually invalidated sessions).
 *
 *   On failure the local authStore is cleared before redirecting, so the
 *   stale token is not left in localStorage.
 *
 * PocketBase auth docs:
 *   https://pocketbase.io/docs/authentication/
 *   "You must explicitly call authRefresh() to verify and renew a token."
 */
export async function load() {
	if (!browser) return;

	// Layer 1: fast local check — no network
	if (!pb.authStore.isValid) {
		redirect(302, '/login');
	}

	// Layer 2: server-side validation — catches revoked tokens
	try {
		await pb.collection('users').authRefresh();
	} catch {
		// Token was rejected by the server (expired, revoked, or user deleted).
		// Clear the stale local token before redirecting.
		pb.authStore.clear();
		redirect(302, '/login');
	}
}
