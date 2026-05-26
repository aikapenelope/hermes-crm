<script lang="ts">
	import '../app.css';
	import { toast } from '$lib/stores';
	import { PWAInstall } from '$lib/ui';

	let { children } = $props();
</script>

{@render children()}

<!-- PWA install prompt -->
<PWAInstall />

<!-- ── Toast container ──────────────────────────────────────────────────── -->
{#if $toast.length > 0}
	<div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
		{#each $toast as t (t.id)}
			<div
				class="flex items-center gap-3 px-4 py-3 text-[11px] font-medium shadow-lg transition-all
					tracking-widest uppercase
					{t.variant === 'success'
					? 'bg-emerald-600 text-white'
					: t.variant === 'error'
						? 'bg-red-600 text-white'
						: 'bg-[#222] text-white'}"
			>
				{t.message}
			</div>
		{/each}
	</div>
{/if}
