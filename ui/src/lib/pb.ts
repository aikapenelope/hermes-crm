import PocketBase from 'pocketbase';

/**
 * PocketBase client singleton.
 *
 * In production the SPA is served by PocketBase itself (same origin),
 * so we can use window.location.origin directly.
 *
 * In development (vite dev server on :5173), set VITE_PB_URL=http://localhost:8090
 * in ui/.env.local to point at a running PocketBase instance.
 */
const pbUrl: string =
	import.meta.env.VITE_PB_URL ??
	(typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8090');

const pb = new PocketBase(pbUrl);

// Disable auto-cancellation: allows concurrent requests without race conditions.
// Recommended for apps that fire multiple simultaneous API calls.
pb.autoCancellation(false);

export default pb;
