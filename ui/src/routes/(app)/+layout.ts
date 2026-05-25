import { browser } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import pb from '$lib/pb';

/**
 * Auth guard for all (app) routes.
 * Runs on the client (ssr=false) — redirects to /login when no valid token.
 */
export function load() {
	if (browser && !pb.authStore.isValid) {
		redirect(302, '/login');
	}
}
