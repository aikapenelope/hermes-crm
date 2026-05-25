<script lang="ts">
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { Package } from 'lucide-svelte';
	import type { ListResult } from 'pocketbase';

	type Product = {
		id: string; name: string; sku: string; type: string;
		description: string; price: number; currency: string; active: boolean;
	};

	let result = $state<ListResult<Product> | null>(null);
	let loading = $state(true);
	let filterType = $state('');
	let filterActive = $state('');
	let page = $state(1);
	const perPage = 20;

	async function fetchProducts() {
		loading = true;
		try {
			const filters: string[] = [];
			if (filterType) filters.push(`type = '${filterType}'`);
			if (filterActive !== '') filters.push(`active = ${filterActive}`);
			result = await pb.collection('products').getList<Product>(page, perPage, {
				filter: filters.join(' && ') || undefined,
				sort: 'name',
				fields: 'id,name,sku,type,description,price,currency,active',
			});
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al cargar productos');
		} finally { loading = false; }
	}

	onMount(fetchProducts);
	$effect(() => { filterType; filterActive; page; fetchProducts(); });

	const typeLabels: Record<string, string> = {
		product: 'Producto', service: 'Servicio',
		subscription: 'Suscripción', license: 'Licencia',
	};
	const currencySymbols: Record<string, string> = {
		USD: '$', COP: 'COP$', EUR: '€', MXN: 'MX$', BRL: 'R$', ARS: 'AR$',
	};
</script>

<svelte:head><title>Productos — Hermes CRM</title></svelte:head>

<div class="flex-1 p-6">
	<div class="mb-5 flex items-center justify-between">
		<div>
			<h1 class="text-xl font-semibold text-slate-100">Productos & Servicios</h1>
			<p class="text-sm text-slate-400">{result ? `${result.totalItems} items` : '…'}</p>
		</div>
		<button
			onclick={() => toast.info('Crear producto — próximamente')}
			class="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
		>
			<Package class="h-4 w-4" /> Nuevo producto
		</button>
	</div>

	<div class="mb-4 flex gap-3 flex-wrap">
		<select bind:value={filterType}
			class="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-500">
			<option value="">Todos los tipos</option>
			<option value="product">Producto</option>
			<option value="service">Servicio</option>
			<option value="subscription">Suscripción</option>
			<option value="license">Licencia</option>
		</select>
		<select bind:value={filterActive}
			class="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-500">
			<option value="">Activos e inactivos</option>
			<option value="true">Solo activos</option>
			<option value="false">Solo inactivos</option>
		</select>
	</div>

	<div class="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
		{#if loading && !result}
			<div class="flex items-center gap-2 p-8 text-sm text-slate-400">
				<div class="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500"></div>
				Cargando…
			</div>
		{:else if result && result.items.length === 0}
			<p class="p-8 text-center text-sm text-slate-500">Sin productos aún</p>
		{:else if result}
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-slate-800">
						<th class="px-4 py-3 text-left text-xs font-medium text-slate-400">Nombre</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-slate-400 hidden md:table-cell">SKU</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-slate-400">Tipo</th>
						<th class="px-4 py-3 text-right text-xs font-medium text-slate-400">Precio</th>
						<th class="px-4 py-3 text-center text-xs font-medium text-slate-400">Estado</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-800">
					{#each result.items as p (p.id)}
						<tr class="hover:bg-slate-800/40 transition-colors {!p.active ? 'opacity-50' : ''}">
							<td class="px-4 py-3">
								<div>
									<p class="font-medium text-slate-200">{p.name}</p>
									{#if p.description}
										<p class="text-xs text-slate-500 truncate max-w-xs">{p.description}</p>
									{/if}
								</div>
							</td>
							<td class="px-4 py-3 text-slate-400 font-mono text-xs hidden md:table-cell">{p.sku || '—'}</td>
							<td class="px-4 py-3">
								<span class="rounded px-1.5 py-0.5 text-xs bg-slate-700 text-slate-300">
									{typeLabels[p.type] ?? p.type}
								</span>
							</td>
							<td class="px-4 py-3 text-right font-medium text-emerald-400">
								{#if p.price}
									{currencySymbols[p.currency] ?? ''}{p.price.toLocaleString()}
								{:else}
									<span class="text-slate-600">—</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-center">
								<span class="rounded-full px-2 py-0.5 text-xs font-medium
									{p.active ? 'bg-emerald-900/50 text-emerald-300' : 'bg-slate-700 text-slate-400'}">
									{p.active ? 'Activo' : 'Inactivo'}
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if result.totalPages > 1}
				<div class="flex items-center justify-between border-t border-slate-800 px-4 py-3">
					<span class="text-xs text-slate-500">Página {result.page} de {result.totalPages}</span>
					<div class="flex gap-2">
						<button onclick={() => { page = page - 1; }} disabled={page <= 1}
							class="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-40">← Anterior</button>
						<button onclick={() => { page = page + 1; }} disabled={page >= result.totalPages}
							class="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-40">Siguiente →</button>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>
