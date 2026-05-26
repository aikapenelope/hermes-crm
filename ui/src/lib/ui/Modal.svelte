<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { AlertTriangle } from 'lucide-svelte';

	interface Props {
		open: boolean;
		title: string;
		message: string;
		confirmLabel?: string;
		variant?: 'danger' | 'default';
		loading?: boolean;
		onconfirm: () => void;
		oncancel: () => void;
	}

	let {
		open, title, message,
		confirmLabel = 'Confirmar',
		variant = 'default',
		loading = false,
		onconfirm, oncancel,
	}: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') oncancel();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		role="presentation"
		transition:fade={{ duration: 150 }}
	>
		<!-- Backdrop -->
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
		<div role="presentation" class="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onclick={oncancel}></div>

		<!-- Dialog -->
		<div
			class="relative w-full max-w-sm rounded-2xl border border-slate-700/60 bg-slate-900 p-6 shadow-2xl"
			role="dialog"
			aria-modal="true"
			transition:scale={{ start: 0.95, duration: 180 }}
		>
			{#if variant === 'danger'}
				<div class="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-900/40">
					<AlertTriangle class="h-5 w-5 text-red-400" />
				</div>
			{/if}

			<h3 class="mb-2 text-base font-semibold text-slate-50">{title}</h3>
			<p class="mb-6 text-sm text-slate-400 leading-relaxed">{message}</p>

			<div class="flex justify-end gap-2">
				<button
					onclick={oncancel}
					class="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300
						transition-colors hover:bg-slate-800"
				>
					Cancelar
				</button>
				<button
					onclick={onconfirm}
					disabled={loading}
					class="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors
						disabled:cursor-not-allowed disabled:opacity-60
						{variant === 'danger'
						? 'bg-red-600 hover:bg-red-500'
						: 'bg-blue-600 hover:bg-blue-500'}"
				>
					{loading ? 'Procesando…' : confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}
