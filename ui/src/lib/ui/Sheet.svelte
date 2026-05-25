<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { X } from 'lucide-svelte';

	interface Props {
		open: boolean;
		title: string;
		description?: string;
		onclose: () => void;
		children: import('svelte').Snippet;
		footer?: import('svelte').Snippet;
		width?: 'sm' | 'md' | 'lg';
	}

	let { open, title, description, onclose, children, footer, width = 'md' }: Props = $props();

	const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-lg' };

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
		role="presentation"
		onclick={onclose}
		transition:fade={{ duration: 200 }}
	></div>

	<!-- Panel -->
	<div
		class="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-slate-700/60
			bg-slate-900 shadow-2xl {widths[width]}"
		role="dialog"
		aria-modal="true"
		aria-labelledby="sheet-title"
		transition:fly={{ x: 400, duration: 280, opacity: 1 }}
	>
		<!-- Header -->
		<div class="flex shrink-0 items-start justify-between border-b border-slate-800 px-5 py-4">
			<div>
				<h2 id="sheet-title" class="text-base font-semibold text-slate-50">{title}</h2>
				{#if description}
					<p class="mt-0.5 text-sm text-slate-400">{description}</p>
				{/if}
			</div>
			<button
				onclick={onclose}
				class="ml-4 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
				aria-label="Cerrar"
			>
				<X class="h-4 w-4" />
			</button>
		</div>

		<!-- Body -->
		<div class="flex-1 overflow-y-auto px-5 py-4">
			{@render children()}
		</div>

		<!-- Footer -->
		{#if footer}
			<div class="shrink-0 border-t border-slate-800 px-5 py-4">
				{@render footer()}
			</div>
		{/if}
	</div>
{/if}
