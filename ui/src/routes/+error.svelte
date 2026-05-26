<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Btn } from '$lib/ui';
	import { AlertTriangle, ArrowLeft } from 'lucide-svelte';
</script>

<svelte:head><title>Error — Hermes CRM</title></svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center">
	<div class="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-900/30">
		<AlertTriangle class="h-8 w-8 text-red-400" />
	</div>

	<h1 class="mb-2 text-2xl font-bold text-slate-50">
		{$page.status === 404 ? 'Página no encontrada' : 'Algo salió mal'}
	</h1>
	<p class="mb-8 max-w-sm text-sm text-slate-400">
		{$page.error?.message ?? ($page.status === 404
			? 'La página que buscas no existe o fue movida.'
			: 'Ocurrió un error inesperado. Intenta recargar la página.')}
	</p>

	<div class="flex gap-3">
		<Btn variant="secondary" onclick={() => history.back()}>
			{#snippet icon()}<ArrowLeft class="h-4 w-4" />{/snippet}
			Volver
		</Btn>
		<Btn variant="primary" onclick={() => goto('/')}>Ir al inicio</Btn>
	</div>

	{#if $page.status !== 404}
		<p class="mt-8 font-mono text-xs text-slate-700">
			Error {$page.status}
		</p>
	{/if}
</div>
