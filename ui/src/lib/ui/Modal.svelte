<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { AlertTriangle } from 'lucide-svelte';

	interface Props {
		open: boolean; title: string; message: string;
		confirmLabel?: string; variant?: 'danger' | 'default';
		loading?: boolean; onconfirm: () => void; oncancel: () => void;
	}

	let {
		open, title, message,
		confirmLabel = 'Confirmar',
		variant = 'default',
		loading = false,
		onconfirm, oncancel,
	}: Props = $props();

	function handleKeydown(e: KeyboardEvent) { if (e.key === 'Escape') oncancel(); }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4"
		role="presentation" transition:fade={{ duration: 150 }}>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
		<div role="presentation" class="absolute inset-0 bg-black/80 backdrop-blur-[1px]" onclick={oncancel}></div>

		<div class="relative w-full max-w-sm border border-[#1a1a1a] bg-[#080808] p-6 shadow-2xl overflow-hidden"
			role="dialog" aria-modal="true"
			transition:scale={{ start: 0.97, duration: 160 }}>
			<!-- Top accent -->
			<div class="absolute top-0 left-0 right-0 h-[1px]"
				style="background:linear-gradient(to right,#ff3333,#ffaa00,#00ffaa,#00aaff,#aa00ff);"></div>

			{#if variant === 'danger'}
				<div class="mb-4 flex h-8 w-8 items-center justify-center border border-red-500/40">
					<AlertTriangle class="h-4 w-4 text-red-400" />
				</div>
			{/if}

			<div class="mb-0.5 text-[9px] tracking-widest text-[#444] uppercase">CONFIRMAR.ACCIÓN</div>
			<h3 class="mb-2 text-sm font-bold tracking-widest text-white uppercase"
				style="font-family:ui-monospace,monospace;">{title}</h3>
			<p class="mb-6 text-[11px] text-[#666] leading-relaxed tracking-wide">{message}</p>

			<div class="flex justify-end gap-2">
				<button onclick={oncancel}
					class="border border-[#333] px-4 py-2 text-[10px] font-medium tracking-widest uppercase
						text-[#888] transition-colors hover:border-[#555] hover:text-white">
					Cancelar
				</button>
				<button onclick={onconfirm} disabled={loading}
					class="px-4 py-2 text-[10px] font-medium tracking-widest uppercase text-black
						transition-colors disabled:cursor-not-allowed disabled:opacity-50
						{variant === 'danger' ? 'bg-red-500 hover:bg-red-400' : 'bg-white hover:bg-[#e0e0e0]'}">
					{loading ? 'PROCESANDO…' : confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}
