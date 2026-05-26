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
	<div
		class="fixed inset-0 z-40 bg-black/80 backdrop-blur-[1px]"
		role="presentation"
		onclick={onclose}
		transition:fade={{ duration: 150 }}
	></div>

	<div
		class="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[#1a1a1a]
			bg-[#080808] shadow-2xl {widths[width]}"
		role="dialog"
		aria-modal="true"
		aria-labelledby="sheet-title"
		transition:fly={{ x: 400, duration: 240, opacity: 1 }}
	>
		<!-- Top rainbow accent -->
		<div class="h-[1px] flex-shrink-0"
			style="background:linear-gradient(to right,#ff3333,#ffaa00,#00ffaa,#00aaff,#aa00ff);">
		</div>

		<!-- Header -->
		<div class="flex shrink-0 items-start justify-between border-b border-[#1a1a1a] px-5 py-4">
			<div>
				<div class="mb-0.5 text-[9px] tracking-widest text-[#444] uppercase">SYS.PANEL</div>
				<h2 id="sheet-title"
					class="text-sm font-bold tracking-widest text-white uppercase"
					style="font-family:ui-monospace,monospace;"
				>{title}</h2>
				{#if description}
					<p class="mt-1 text-[10px] tracking-wide text-[#555] uppercase">{description}</p>
				{/if}
			</div>
			<button
				onclick={onclose}
				class="ml-4 shrink-0 p-1.5 text-[#444] transition-colors hover:text-white"
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
			<div class="shrink-0 border-t border-[#1a1a1a] px-5 py-4">
				{@render footer()}
			</div>
		{/if}
	</div>
{/if}
