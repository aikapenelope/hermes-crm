<script lang="ts">
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { Sheet, Modal, Btn, Badge, Skeleton, Empty } from '$lib/ui';
	import ProductForm from '$lib/forms/ProductForm.svelte';
	import { Package, Plus, Pencil, Trash2 } from 'lucide-svelte';
	import type { ListResult } from 'pocketbase';

	type Product = { id: string; name: string; sku: string; type: string; description: string; price: number; currency: string; active: boolean };

	let result        = $state<ListResult<Product> | null>(null);
	let loading       = $state(true);
	let filterType    = $state('');
	let filterActive  = $state('');
	let page          = $state(1);
	const perPage     = 20;
	let sheetOpen     = $state(false);
	let editingProduct = $state<Product | null>(null);
	let deleteTarget  = $state<Product | null>(null);
	let deleting      = $state(false);

	async function fetchProducts() {
		loading = true;
		try {
			const filters: string[] = [];
			if (filterType) filters.push(`type = '${filterType}'`);
			if (filterActive !== '') filters.push(`active = ${filterActive}`);
			result = await pb.collection('products').getList<Product>(page, perPage, {
				filter: filters.join(' && ') || undefined,
				sort: 'name',
			});
		} catch (e: unknown) { toast.error('Error al cargar'); } finally { loading = false; }
	}

	onMount(fetchProducts);
	$effect(() => { filterType; filterActive; page; fetchProducts(); });

	function handleSaved() { sheetOpen = false; fetchProducts(); }

	async function confirmDelete() {
		if (!deleteTarget) return;
		deleting = true;
		try {
			await pb.collection('products').delete(deleteTarget.id);
			toast.success('Producto eliminado');
			deleteTarget = null;
			fetchProducts();
		} catch (e: unknown) { toast.error('Error al eliminar'); } finally { deleting = false; }
	}

	const typeLabel: Record<string, string> = {
		product: 'Producto', service: 'Servicio', subscription: 'Suscripción', license: 'Licencia',
	};
	const currencySymbol: Record<string, string> = {
		USD: '$', COP: 'COP$', EUR: '€', MXN: 'MX$', BRL: 'R$', ARS: 'AR$',
	};
</script>

<svelte:head><title>Productos — Hermes CRM</title></svelte:head>

<div class="flex-1 p-5 md:p-6">
	<div class="mb-5 flex items-center justify-between">
		<div>
			<h1>Productos & Servicios</h1>
			<p class="mt-0.5 text-sm text-slate-400">{result ? `${result.totalItems} items` : '…'}</p>
		</div>
		<Btn variant="primary" onclick={() => { editingProduct = null; sheetOpen = true; }}>
			{#snippet icon()}<Plus class="h-4 w-4" />{/snippet}
			Nuevo producto
		</Btn>
	</div>

	<div class="mb-4 flex gap-3 flex-wrap">
		<select bind:value={filterType}
			class="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-500">
			<option value="">Todos los tipos</option>
			<option value="product">Producto</option>
			<option value="service">Servicio</option>
			<option value="subscription">Suscripción</option>
			<option value="license">Licencia</option>
		</select>
		<select bind:value={filterActive}
			class="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-500">
			<option value="">Activos e inactivos</option>
			<option value="true">Solo activos</option>
			<option value="false">Solo inactivos</option>
		</select>
	</div>

	<div class="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
		{#if loading && !result}
			<div class="p-5"><Skeleton rows={5} /></div>
		{:else if result && result.items.length === 0}
			<Empty title="Sin productos" description="Añade tu catálogo de productos y servicios">
				{#snippet icon()}<Package class="h-5 w-5" />{/snippet}
				{#snippet action()}<Btn variant="primary" onclick={() => { editingProduct = null; sheetOpen = true; }}>
					{#snippet icon()}<Plus class="h-4 w-4" />{/snippet}Crear producto
				</Btn>{/snippet}
			</Empty>
		{:else if result}
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-slate-800">
						<th class="px-4 py-3 text-left text-xs font-medium text-slate-400">Producto</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-slate-400 hidden md:table-cell">Tipo</th>
						<th class="px-4 py-3 text-right text-xs font-medium text-slate-400">Precio</th>
						<th class="px-4 py-3 text-center text-xs font-medium text-slate-400">Estado</th>
						<th class="px-4 py-3 text-right text-xs font-medium text-slate-400">Acciones</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-800">
					{#each result.items as p (p.id)}
						<tr class="group hover:bg-slate-800/40 transition-colors {!p.active ? 'opacity-50' : ''}">
							<td class="px-4 py-3">
								<p class="font-medium text-slate-200">{p.name}</p>
								{#if p.sku}<p class="font-mono text-xs text-slate-500">{p.sku}</p>{/if}
							</td>
							<td class="px-4 py-3 hidden md:table-cell">
								<Badge variant="slate">{typeLabel[p.type] ?? p.type}</Badge>
							</td>
							<td class="px-4 py-3 text-right font-semibold text-emerald-400">
								{p.price ? `${currencySymbol[p.currency] ?? ''}${p.price.toLocaleString()}` : '—'}
							</td>
							<td class="px-4 py-3 text-center">
								<Badge variant={p.active ? 'green' : 'slate'}>
									{p.active ? 'Activo' : 'Inactivo'}
								</Badge>
							</td>
							<td class="px-4 py-3 text-right">
								<div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
									<button onclick={() => { editingProduct = p; sheetOpen = true; }}
										class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200">
										<Pencil class="h-3.5 w-3.5" />
									</button>
									<button onclick={() => { deleteTarget = p; }}
										class="rounded-lg p-1.5 text-slate-400 hover:bg-red-900/40 hover:text-red-400">
										<Trash2 class="h-3.5 w-3.5" />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if result.totalPages > 1}
				<div class="flex items-center justify-between border-t border-slate-800 px-4 py-3">
					<span class="text-xs text-slate-500">Página {result.page} de {result.totalPages}</span>
					<div class="flex gap-2">
						<Btn variant="ghost" size="sm" onclick={() => { page = page - 1; }} disabled={page <= 1}>← Anterior</Btn>
						<Btn variant="ghost" size="sm" onclick={() => { page = page + 1; }} disabled={page >= result.totalPages}>Siguiente →</Btn>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>

<Sheet open={sheetOpen} title={editingProduct ? 'Editar producto' : 'Nuevo producto'} onclose={() => { sheetOpen = false; }}>
	{#snippet children()}<ProductForm product={editingProduct} onSave={handleSaved} onClose={() => { sheetOpen = false; }} />{/snippet}
</Sheet>

<Modal open={!!deleteTarget} title="Eliminar producto" message="¿Eliminar '{deleteTarget?.name}'?"
	confirmLabel="Eliminar" variant="danger" loading={deleting}
	onconfirm={confirmDelete} oncancel={() => { deleteTarget = null; }} />
