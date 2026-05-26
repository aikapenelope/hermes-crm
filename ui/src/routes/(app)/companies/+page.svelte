<script lang="ts">
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { sanitizeSearch } from '$lib/utils';
	import { Sheet, Modal, Btn, Skeleton, Empty } from '$lib/ui';
	import CompanyForm from '$lib/forms/CompanyForm.svelte';
	import { Building2, Search, Plus, Pencil, Trash2 } from 'lucide-svelte';
	import type { ListResult } from 'pocketbase';

	type Company = { id: string; name: string; industry: string; website: string; city: string; country: string; size: string };

	let result         = $state<ListResult<Company> | null>(null);
	let loading        = $state(true);
	let search         = $state('');
	let page           = $state(1);
	const perPage      = 20;
	let sheetOpen      = $state(false);
	let editingCompany = $state<Company | null>(null);
	let deleteTarget   = $state<Company | null>(null);
	let deleting       = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout>;

	async function fetchCompanies() {
		loading = true;
		try {
			const filter = search.trim() ? `name ~ '${sanitizeSearch(search)}'` : undefined;
			result = await pb.collection('companies').getList<Company>(page, perPage, {
				filter, sort: 'name', fields: 'id,name,industry,website,city,country,size',
			});
		} catch { toast.error('Error al cargar'); } finally { loading = false; }
	}

	onMount(fetchCompanies);
	$effect(() => { page; fetchCompanies(); });

	function onSearchInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => { page = 1; fetchCompanies(); }, 350);
	}
	function handleSaved() { sheetOpen = false; fetchCompanies(); }

	async function confirmDelete() {
		if (!deleteTarget) return;
		deleting = true;
		try {
			await pb.collection('companies').delete(deleteTarget.id);
			toast.success('Empresa eliminada');
			deleteTarget = null;
			fetchCompanies();
		} catch { toast.error('Error al eliminar'); } finally { deleting = false; }
	}

	const industryLabel: Record<string, string> = {
		technology: 'Tecnología', finance: 'Finanzas', healthcare: 'Salud', retail: 'Comercio',
		manufacturing: 'Manufactura', education: 'Educación', real_estate: 'Bienes Raíces',
		hospitality: 'Hostelería', consulting: 'Consultoría', other: 'Otro',
	};
</script>

<svelte:head><title>Empresas — Hermes CRM</title></svelte:head>

<div class="flex-1 p-5 md:p-6 uppercase tracking-widest" style="font-size:11px;">
	<div class="mb-5 flex items-center justify-between">
		<div>
			<h1>Empresas</h1>
			<p class="mt-0.5 text-[10px] text-[#555]">{result ? `${result.totalItems} empresas` : '…'}</p>
		</div>
		<Btn variant="primary" onclick={() => { editingCompany = null; sheetOpen = true; }}>
			{#snippet icon()}<Plus class="h-3.5 w-3.5" />{/snippet}
			Nueva empresa
		</Btn>
	</div>

	<div class="relative mb-4">
		<Search class="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#444]" />
		<input type="search" placeholder="BUSCAR EMPRESAS" bind:value={search} oninput={onSearchInput}
			class="w-full max-w-sm border border-[#222] bg-transparent py-2 pl-9 pr-3
				text-[10px] tracking-widest text-white placeholder-[#333] outline-none focus:border-white transition-colors" />
	</div>

	<div class="overflow-hidden border border-[#1a1a1a] bg-[#090909]">
		{#if loading && !result}
			<div class="p-5"><Skeleton rows={5} /></div>
		{:else if result && result.items.length === 0}
			<Empty title="Sin empresas" description="Añade empresas para organizar tus contactos">
				{#snippet icon()}<Building2 class="h-5 w-5" />{/snippet}
				{#snippet action()}<Btn variant="primary" onclick={() => { editingCompany = null; sheetOpen = true; }}>
					{#snippet icon()}<Plus class="h-3.5 w-3.5" />{/snippet}Crear empresa
				</Btn>{/snippet}
			</Empty>
		{:else if result}
			<table class="w-full">
				<thead>
					<tr class="border-b border-[#1a1a1a]">
						<th class="px-4 py-3 text-left text-[9px] text-[#444]">EMPRESA</th>
						<th class="px-4 py-3 text-left text-[9px] text-[#444] hidden md:table-cell">INDUSTRIA</th>
						<th class="px-4 py-3 text-left text-[9px] text-[#444] hidden lg:table-cell">UBICACIÓN</th>
						<th class="px-4 py-3 text-right text-[9px] text-[#444]">ACCIONES</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-[#1a1a1a]">
					{#each result.items as c (c.id)}
						<tr class="group hover:bg-[#111] transition-colors">
							<td class="px-4 py-3">
								<div class="flex items-center gap-2.5">
									<div class="flex h-7 w-7 shrink-0 items-center justify-center border border-[#222] bg-[#111] text-[10px] font-bold text-[#666]">
										{(c.name || '?')[0].toUpperCase()}
									</div>
									<div>
										<a href="/companies/{c.id}"
											class="font-medium text-[#aaa] hover:text-white transition-colors normal-case" style="letter-spacing:0;">
											{c.name}
										</a>
										{#if c.website}
											<p class="text-[9px] text-[#444] truncate max-w-40 normal-case">
												{c.website.replace(/^https?:\/\//, '')}
											</p>
										{/if}
									</div>
								</div>
							</td>
							<td class="px-4 py-3 text-[#555] hidden md:table-cell">{industryLabel[c.industry] ?? c.industry ?? '—'}</td>
							<td class="px-4 py-3 text-[#555] hidden lg:table-cell">{[c.city, c.country].filter(Boolean).join(', ') || '—'}</td>
							<td class="px-4 py-3 text-right">
								<div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
									<button onclick={() => { editingCompany = c; sheetOpen = true; }}
										class="p-1.5 text-[#444] hover:bg-[#111] hover:text-white transition-colors">
										<Pencil class="h-3.5 w-3.5" />
									</button>
									<button onclick={() => { deleteTarget = c; }}
										class="p-1.5 text-[#444] hover:bg-red-900/40 hover:text-red-400 transition-colors">
										<Trash2 class="h-3.5 w-3.5" />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if result.totalPages > 1}
				<div class="flex items-center justify-between border-t border-[#1a1a1a] px-4 py-3">
					<span class="text-[9px] text-[#444]">PÁGINA {result.page} / {result.totalPages}</span>
					<div class="flex gap-2">
						<Btn variant="ghost" size="sm" onclick={() => { page = page - 1; }} disabled={page <= 1}>← ANTERIOR</Btn>
						<Btn variant="ghost" size="sm" onclick={() => { page = page + 1; }} disabled={page >= result.totalPages}>SIGUIENTE →</Btn>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>

<Sheet open={sheetOpen} title={editingCompany ? 'Editar empresa' : 'Nueva empresa'} onclose={() => { sheetOpen = false; }}>
	{#snippet children()}<CompanyForm company={editingCompany} onSave={handleSaved} onClose={() => { sheetOpen = false; }} />{/snippet}
</Sheet>

<Modal open={!!deleteTarget} title="Eliminar empresa" message="¿Eliminar '{deleteTarget?.name}'?"
	confirmLabel="Eliminar" variant="danger" loading={deleting}
	onconfirm={confirmDelete} oncancel={() => { deleteTarget = null; }} />
