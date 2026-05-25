import { writable, derived } from 'svelte/store';
import type { RecordModel } from 'pocketbase';
import pb from './pb';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** The currently authenticated user record, or null if not logged in. */
export const currentUser = writable<RecordModel | null>(pb.authStore.record);

// Keep the store in sync with PocketBase's own auth state.
pb.authStore.onChange(() => {
	currentUser.set(pb.authStore.record);
});

/** True when a valid auth token is stored. */
export const isAuthenticated = derived(currentUser, ($user) => $user !== null);

// ---------------------------------------------------------------------------
// Toast notifications (lightweight, no external lib)
// ---------------------------------------------------------------------------

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
	id: number;
	message: string;
	variant: ToastVariant;
}

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);
	let nextId = 0;

	function show(message: string, variant: ToastVariant = 'info', duration = 3500) {
		const id = ++nextId;
		update((toasts) => [...toasts, { id, message, variant }]);
		setTimeout(() => {
			update((toasts) => toasts.filter((t) => t.id !== id));
		}, duration);
	}

	return {
		subscribe,
		success: (msg: string) => show(msg, 'success'),
		error: (msg: string) => show(msg, 'error', 5000),
		info: (msg: string) => show(msg, 'info'),
	};
}

export const toast = createToastStore();
