<script lang="ts">
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { Building2, Search } from 'lucide-svelte';
	import type { ListResult } from 'pocketbase';

	type Company = {
		id: string; name: string; industry: string; website: string;
		city: string; country: string; size: string;
	};

	let result = $state<ListResult<Company> | null>(null);
	let loading = $state(true);
	let search = $state('');
	let page = $state(1);
	const perPage = 20;
	let debounceTimer: ReturnType<typeof setTimeout>;

	async function fetchCompanies() {
		loading = true;
		try {
			const filters = search.trim() ? `name ~ '${search}'` : undefined;
			result = await pb.collection('companies').getList<Company>(page, perPage, {
				filter: filters,
				sort: 'name',
				fields: 'id,name,industry,website,city,country,size',
			});
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al cargar empresas');
		} finally { loading = false; }
	}

	onMount(fetchCompanies);
	$effect(() => { page; fetchCompanies(); });

	function onSearchInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => { page = 1; fetchCompanies(); }, 350);
	}

	const sizeLabels: Record<string, string> = {
		'1-10': '1–10', '11-50': '11–50', '51-200': '51–200',
		'201-500': '201–500', '500+': '500+',
	};
</script>

<svelte:head><title>Empresas — Hermes CRM</title></svelte:head>

<div class="flex-1 p-6">
	<div class="mb-5 flex items-center justify-between">
		<div>
			<h1 class="text-xl font-semibold text-slate-100">Empresas</h1>
			<p class="text-sm text-slate-400">{result ? `${result.totalItems} empresas` : '…'}</p>
		</div>
		<button
			onclick={() => toast.info('Crear empresa — próximamente')}
			class="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
		>
			<Building2 class="h-4 w-4" /> Nueva empresa
		</button>
	</div>

	<div class="mb-4 relative">
		<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
		<input type="search" placeholder="Buscar empresas…" bind:value={search} oninput={onSearchInput}
			class="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm
				text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500" />
	</div>

	<div class="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
		{#if loading && !result}
			<div class="flex items-center gap-2 p-8 text-sm text-slate-400">
				<div class="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500"></div>
				Cargando…
			</div>
		{:else if result && result.items.length === 0}
			<p class="p-8 text-center text-sm text-slate-500">Sin empresas aún</p>
		{:else if result}
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-slate-800">
						<th class="px-4 py-3 text-left text-xs font-medium text-slate-400">Empresa</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-slate-400 hidden md:table-cell">Industria</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-slate-400 hidden lg:table-cell">Ciudad</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-slate-400 hidden lg:table-cell">Tamaño</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-slate-400 hidden md:table-cell">Web</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-800">
					{#each result.items as c (c.id)}
						<tr class="hover:bg-slate-800/40 transition-colors">
							<td class="px-4 py-3">
								<div class="flex items-center gap-2.5">
									<div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-xs font-semibold text-slate-300">
										{(c.name || '?')[0].toUpperCase()}
									</div>
									<span class="font-medium text-slate-200">{c.name}</span>
								</div>
							</td>
							<td class="px-4 py-3 text-slate-400 hidden md:table-cell capitalize">{c.industry || '—'}</td>
							<td class="px-4 py-3 text-slate-400 hidden lg:table-cell">{[c.city, c.country].filter(Boolean).join(', ') || '—'}</td>
							<td class="px-4 py-3 text-slate-400 hidden lg:table-cell">{sizeLabels[c.size] ?? c.size ?? '—'}</td>
							<td class="px-4 py-3 hidden md:table-cell">
								{#if c.website}
									<a href={c.website} target="_blank" class="text-xs text-blue-400 hover:text-blue-300 truncate max-w-32 block">
										{c.website.replace(/^https?:\/\//, '')}
									</a>
								{:else}
									<span class="text-slate-600">—</span>
								{/if}
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
