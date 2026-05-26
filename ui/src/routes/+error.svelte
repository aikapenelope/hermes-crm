<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Btn } from '$lib/ui';
	import { AlertTriangle, ArrowLeft } from 'lucide-svelte';
</script>

<svelte:head><title>Error — Hermes CRM</title></svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-[#070707] px-4 text-center uppercase tracking-widest" style="font-size:11px;">
	<div class="mb-6 flex h-12 w-12 items-center justify-center border border-red-500/40">
		<AlertTriangle class="h-6 w-6 text-red-400" />
	</div>

	<h1 class="mb-2 text-lg font-bold text-white">
		{$page.status === 404 ? 'PÁGINA NO ENCONTRADA' : 'ALGO SALIÓ MAL'}
	</h1>
	<p class="mb-8 max-w-sm text-[10px] text-[#555]">
		{$page.error?.message ?? ($page.status === 404
			? 'La página que buscas no existe o fue movida.'
			: 'Ocurrió un error inesperado. Intenta recargar la página.')}
	</p>

	<div class="flex gap-3">
		<Btn variant="outline" onclick={() => history.back()}>
			{#snippet icon()}<ArrowLeft class="h-3.5 w-3.5" />{/snippet}
			Volver
		</Btn>
		<Btn variant="primary" onclick={() => goto('/')}>Ir al inicio</Btn>
	</div>

	{#if $page.status !== 404}
		<p class="mt-8 text-[8px] text-[#333]">Error {$page.status}</p>
	{/if}
</div>
