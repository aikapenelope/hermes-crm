<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { sanitizeSearch } from '$lib/utils';
	import { Sheet, Modal, Btn, Badge, Skeleton, Empty } from '$lib/ui';
	import ContactForm from '$lib/forms/ContactForm.svelte';
	import { UserPlus, Search, Pencil, Trash2, Users, Upload, Tag } from 'lucide-svelte';
	import type { ListResult } from 'pocketbase';

	type Tag    = { id: string; label: string; color?: string };
	type Contact = {
		id: string; name: string; email: string; phone: string;
		status: string; source: string; created: string;
		tags: string[];
		expand?: { tags?: Tag[] };
	};

	// ── Data ──────────────────────────────────────────────────────────────────
	let result       = $state<ListResult<Contact> | null>(null);
	let loading      = $state(true);
	let search       = $state('');
	let filterStatus = $state('');
	let filterTagId  = $state('');
	let page         = $state(1);
	const perPage    = 25;

	let allTags      = $state<Tag[]>([]);

	// ── Sheet / Delete ────────────────────────────────────────────────────────
	let sheetOpen      = $state(false);
	let editingContact = $state<Contact | null>(null);
	let deleteTarget   = $state<Contact | null>(null);
	let deleting       = $state(false);

	// ── Bulk actions ──────────────────────────────────────────────────────────
	let selectedIds  = $state<Set<string>>(new Set());
	let bulkStatus   = $state('');
	let bulkWorking  = $state(false);

	function toggleSelect(id: string) {
		const s = new Set(selectedIds);
		s.has(id) ? s.delete(id) : s.add(id);
		selectedIds = s;
	}
	function toggleAll() {
		if (!result) return;
		if (selectedIds.size === result.items.length) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(result.items.map(c => c.id));
		}
	}
	async function bulkSetStatus() {
		if (!bulkStatus || selectedIds.size === 0) return;
		bulkWorking = true;
		try {
			const ids = [...selectedIds];
			// Batch in groups of 20 to avoid overwhelming PocketBase
			for (let i = 0; i < ids.length; i += 20) {
				await Promise.all(ids.slice(i, i + 20).map(id =>
					pb.collection('contacts').update(id, { status: bulkStatus })
				));
			}
			toast.success(`${ids.length} contactos actualizados`);
			selectedIds = new Set();
			bulkStatus = '';
			await fetchContacts();
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error en bulk update');
		} finally { bulkWorking = false; }
	}
	function exportSelected() {
		if (!result || selectedIds.size === 0) return;
		const rows = result.items.filter(c => selectedIds.has(c.id));
		const csv = [
			'nombre,email,teléfono,estado,fuente',
			...rows.map(c => [c.name, c.email, c.phone, c.status, c.source].join(',')),
		].join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `contactos_${new Date().toISOString().slice(0,10)}.csv`;
		a.click();
	}

	// ── Realtime unsubscribe ──────────────────────────────────────────────────
	let unsubContacts: (() => void) | null = null;

	// ── Debounced search ──────────────────────────────────────────────────────
	let debounceTimer: ReturnType<typeof setTimeout>;
	function onSearchInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => { page = 1; fetchContacts(); }, 350);
	}

	async function fetchContacts() {
		loading = true;
		try {
			const filters: string[] = [];
			if (search.trim()) {
				const q = sanitizeSearch(search);
				filters.push(`(name ~ '${q}' || email ~ '${q}' || phone ~ '${q}')`);
			}
			if (filterStatus) filters.push(`status = '${filterStatus}'`);
			if (filterTagId)  filters.push(`tags ~ '${filterTagId}'`);

			result = await pb.collection('contacts').getList<Contact>(page, perPage, {
				filter: filters.join(' && ') || undefined,
				sort: '-created',
				fields: 'id,name,email,phone,status,source,created,tags',
				expand: 'tags',
			});
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al cargar');
		} finally { loading = false; }
	}

	onMount(async () => {
		// Load tags for filter bar
		try {
			allTags = await pb.collection('tags').getFullList<Tag>({ sort: 'label', fields: 'id,label,color' });
		} catch { /* non-critical */ }

		await fetchContacts();

		// Realtime: contacts created/updated/deleted by Hermes update the list
		unsubContacts = await pb.collection('contacts').subscribe('*', (e) => {
			const rec = e.record as unknown as Contact;
			if (e.action === 'create') {
				result = result ? { ...result, items: [rec, ...result.items], totalItems: result.totalItems + 1 } : null;
			}
			if (e.action === 'update') {
				result = result ? { ...result, items: result.items.map(c => c.id === rec.id ? { ...c, ...rec } : c) } : null;
			}
			if (e.action === 'delete') {
				result = result ? { ...result, items: result.items.filter(c => c.id !== e.record.id), totalItems: result.totalItems - 1 } : null;
			}
		});
	});

	onDestroy(() => { unsubContacts?.(); });

	$effect(() => { filterStatus; filterTagId; page; fetchContacts(); });

	function openCreate() { editingContact = null; sheetOpen = true; }
	function openEdit(c: Contact, e: MouseEvent) {
		e.preventDefault(); e.stopPropagation();
		editingContact = c; sheetOpen = true;
	}
	function handleSaved() { sheetOpen = false; fetchContacts(); }

	async function confirmDelete() {
		if (!deleteTarget) return;
		deleting = true;
		try {
			await pb.collection('contacts').delete(deleteTarget.id);
			toast.success('Contacto eliminado');
			deleteTarget = null;
			fetchContacts();
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al eliminar');
		} finally { deleting = false; }
	}

	const statusBadge: Record<string, 'slate' | 'blue' | 'green' | 'red' | 'amber'> = {
		lead: 'slate', prospect: 'blue', customer: 'green', churned: 'red', inactive: 'amber',
	};
	const statusLabel: Record<string, string> = {
		lead: 'Lead', prospect: 'Prospect', customer: 'Cliente', churned: 'Perdido', inactive: 'Inactivo',
	};
	const sourceLabel: Record<string, string> = {
		manual: 'Manual', whatsapp: 'WhatsApp', instagram: 'Instagram',
		web: 'Web', referral: 'Referido', email: 'Email',
		import: 'Importado', csv: 'CSV', other: 'Otro',
	};
</script>

<svelte:head><title>Contactos — Hermes CRM</title></svelte:head>

<div class="flex-1 p-5 md:p-6 uppercase tracking-widest" style="font-size:11px;">
	<!-- Header -->
	<div class="mb-5 flex items-center justify-between">
		<div>
			<h1>Contactos</h1>
			<p class="mt-0.5 text-[10px] text-[#555]">
				{result ? `${result.totalItems.toLocaleString()} contactos` : '…'}
			</p>
		</div>
		<div class="flex items-center gap-2">
			<a href="/contacts/import">
				<Btn variant="outline">
					{#snippet icon()}<Upload class="h-3.5 w-3.5" />{/snippet}
					Importar
				</Btn>
			</a>
			<Btn variant="primary" onclick={openCreate}>
				{#snippet icon()}<UserPlus class="h-3.5 w-3.5" />{/snippet}
				Nuevo
			</Btn>
		</div>
	</div>

	<!-- Filters -->
	<div class="mb-4 space-y-2">
		<div class="flex flex-wrap gap-2">
			<!-- Search -->
			<div class="relative min-w-52 flex-1">
				<Search class="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#444]" />
				<input
					type="search"
					placeholder="BUSCAR POR NOMBRE, EMAIL O TELÉFONO"
					bind:value={search}
					oninput={onSearchInput}
					class="w-full border border-[#222] bg-transparent py-2 pl-9 pr-3 text-[10px]
						tracking-widest text-white placeholder-[#333] outline-none focus:border-white transition-colors"
				/>
			</div>
			<!-- Status filter -->
			<select
				bind:value={filterStatus}
				class="border border-[#222] bg-[#0a0a0a] px-3 py-2 text-[10px] tracking-wide text-[#888] outline-none focus:border-white"
			>
				<option value="">Todos los estados</option>
				<option value="lead">Lead</option>
				<option value="prospect">Prospect</option>
				<option value="customer">Cliente</option>
				<option value="churned">Perdido</option>
				<option value="inactive">Inactivo</option>
			</select>
		</div>

		<!-- Tag filter bar -->
		{#if allTags.length > 0}
			<div class="flex flex-wrap items-center gap-1">
				<Tag class="h-3 w-3 text-[#333] shrink-0" />
				<button
					onclick={() => { filterTagId = ''; }}
					class="border px-2 py-0.5 text-[8px] tracking-widest uppercase transition-colors
						{!filterTagId ? 'border-white text-white' : 'border-[#222] text-[#555] hover:border-[#444] hover:text-[#888]'}"
				>
					TODOS
				</button>
				{#each allTags as tag}
					<button
						onclick={() => { filterTagId = filterTagId === tag.id ? '' : tag.id; page = 1; }}
						class="border px-2 py-0.5 text-[8px] tracking-widest uppercase transition-colors
							{filterTagId === tag.id ? 'border-white text-white' : 'border-[#222] text-[#555] hover:border-[#444] hover:text-[#888]'}"
					>
						{tag.label}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Bulk action bar (shows when contacts are selected) -->
	{#if selectedIds.size > 0}
		<div class="mb-3 flex items-center gap-3 border border-white bg-[#0a0a0a] px-4 py-2.5">
			<span class="text-[9px] text-white tracking-widest">{selectedIds.size} SELECCIONADOS</span>
			<div class="flex-1"></div>
			<select
				bind:value={bulkStatus}
				class="border border-[#333] bg-[#111] px-2 py-1.5 text-[9px] tracking-widest text-[#888] outline-none focus:border-white"
			>
				<option value="">Cambiar estado…</option>
				<option value="lead">Lead</option>
				<option value="prospect">Prospect</option>
				<option value="customer">Cliente</option>
				<option value="churned">Perdido</option>
				<option value="inactive">Inactivo</option>
			</select>
			{#if bulkStatus}
				<Btn variant="primary" size="sm" loading={bulkWorking} onclick={bulkSetStatus}>
					Aplicar a {selectedIds.size}
				</Btn>
			{/if}
			<Btn variant="outline" size="sm" onclick={exportSelected}>
				Exportar CSV
			</Btn>
			<button onclick={() => { selectedIds = new Set(); }}
				class="text-[#444] hover:text-white transition-colors text-[9px] tracking-widest uppercase">
				CANCELAR
			</button>
		</div>
	{/if}

	<!-- Table -->
	<div class="overflow-hidden border border-[#1a1a1a] bg-[#090909]">
		{#if loading && !result}
			<div class="p-5"><Skeleton rows={6} /></div>
		{:else if result && result.items.length === 0}
			<Empty
				title={search || filterStatus || filterTagId ? 'Sin resultados' : 'Sin contactos aún'}
				description={search || filterStatus || filterTagId ? 'Prueba con otro filtro' : 'Crea tu primer contacto para empezar'}
			>
				{#snippet icon()}<Users class="h-5 w-5" />{/snippet}
				{#snippet action()}
					{#if !search && !filterStatus && !filterTagId}
						<Btn variant="primary" onclick={openCreate}>
							{#snippet icon()}<UserPlus class="h-3.5 w-3.5" />{/snippet}
							Crear primer contacto
						</Btn>
					{/if}
				{/snippet}
			</Empty>
		{:else if result}
			<table class="w-full">
				<thead>
					<tr class="border-b border-[#1a1a1a]">
						<th class="px-3 py-3 w-8">
							<button onclick={toggleAll}
								class="flex h-4 w-4 items-center justify-center border transition-colors
									{result && selectedIds.size === result.items.length ? 'border-white bg-white' : 'border-[#333] hover:border-white'}">
								{#if result && selectedIds.size === result.items.length}
									<span class="text-black text-[8px] font-bold">✓</span>
								{/if}
							</button>
						</th>
						<th class="px-4 py-3 text-left text-[9px] text-[#444]">NOMBRE</th>
						<th class="px-4 py-3 text-left text-[9px] text-[#444] hidden sm:table-cell">EMAIL</th>
						<th class="px-4 py-3 text-left text-[9px] text-[#444] hidden md:table-cell">TELÉFONO</th>
						<th class="px-4 py-3 text-left text-[9px] text-[#444]">ESTADO</th>
						<th class="px-4 py-3 text-left text-[9px] text-[#444] hidden lg:table-cell">TAGS</th>
						<th class="px-4 py-3 text-left text-[9px] text-[#444] hidden xl:table-cell">FUENTE</th>
						<th class="px-4 py-3 text-right text-[9px] text-[#444]">ACCIONES</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-[#1a1a1a]">
					{#each result.items as c (c.id)}
						<tr class="group hover:bg-[#111] transition-colors {selectedIds.has(c.id) ? 'bg-[#0d0d0d]' : ''}">
							<!-- Checkbox -->
							<td class="px-3 py-3">
								<button onclick={() => toggleSelect(c.id)}
									class="flex h-4 w-4 items-center justify-center border transition-colors
										{selectedIds.has(c.id) ? 'border-white bg-white' : 'border-[#222] hover:border-[#555]'}">
									{#if selectedIds.has(c.id)}
										<span class="text-black text-[8px] font-bold">✓</span>
									{/if}
								</button>
							</td>
							<!-- Name + initials -->
							<td class="px-4 py-3">
								<a href="/contacts/{c.id}" class="flex items-center gap-3 hover:text-white transition-colors">
									<div class="flex h-7 w-7 shrink-0 items-center justify-center border border-[#222] bg-[#111]
										text-[10px] font-bold text-[#666]">
										{(c.name || c.email || '?')[0].toUpperCase()}
									</div>
									<span class="font-medium text-[#aaa] group-hover:text-white transition-colors normal-case"
										style="letter-spacing:0;">
										{c.name || '—'}
									</span>
								</a>
							</td>
							<td class="px-4 py-3 text-[#555] hidden sm:table-cell normal-case" style="letter-spacing:0;">
								{c.email || '—'}
							</td>
							<td class="px-4 py-3 text-[#555] hidden md:table-cell normal-case" style="letter-spacing:0;">
								{c.phone || '—'}
							</td>
							<td class="px-4 py-3">
								{#if c.status}
									<Badge variant={statusBadge[c.status] ?? 'slate'}>
										{statusLabel[c.status] ?? c.status}
									</Badge>
								{:else}
									<span class="text-[#333]">—</span>
								{/if}
							</td>
							<!-- Tags column -->
							<td class="px-4 py-3 hidden lg:table-cell">
								{#if c.expand?.tags && c.expand.tags.length > 0}
									<div class="flex flex-wrap gap-1">
										{#each c.expand.tags.slice(0, 3) as tag}
											<button
												onclick={() => { filterTagId = tag.id; page = 1; }}
												class="border border-[#222] px-1.5 py-0.5 text-[7px] text-[#555]
													tracking-widest uppercase hover:border-[#444] hover:text-white transition-colors"
											>
												{tag.label}
											</button>
										{/each}
										{#if c.expand.tags.length > 3}
											<span class="text-[8px] text-[#333]">+{c.expand.tags.length - 3}</span>
										{/if}
									</div>
								{:else}
									<span class="text-[#2a2a2a]">—</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-[#555] hidden xl:table-cell">
								{sourceLabel[c.source] ?? c.source ?? '—'}
							</td>
							<td class="px-4 py-3 text-right">
								<div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
									<button
										onclick={(e) => openEdit(c, e)}
										class="p-1.5 text-[#444] transition-colors hover:bg-[#111] hover:text-white"
										title="Editar"
									>
										<Pencil class="h-3.5 w-3.5" />
									</button>
									<button
										onclick={(e) => { e.stopPropagation(); deleteTarget = c; }}
										class="p-1.5 text-[#444] transition-colors hover:bg-red-900/40 hover:text-red-400"
										title="Eliminar"
									>
										<Trash2 class="h-3.5 w-3.5" />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<!-- Pagination -->
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

<!-- Sheet -->
<Sheet
	open={sheetOpen}
	title={editingContact ? 'Editar contacto' : 'Nuevo contacto'}
	description={editingContact ? 'Modifica la información del contacto' : 'Añade un contacto a tu CRM'}
	onclose={() => { sheetOpen = false; }}
>
	{#snippet children()}
		<ContactForm
			contact={editingContact}
			onSave={handleSaved}
			onClose={() => { sheetOpen = false; }}
		/>
	{/snippet}
</Sheet>

<!-- Delete Modal -->
<Modal
	open={!!deleteTarget}
	title="Eliminar contacto"
	message="¿Seguro que deseas eliminar a {deleteTarget?.name || 'este contacto'}?"
	confirmLabel="Eliminar"
	variant="danger"
	loading={deleting}
	onconfirm={confirmDelete}
	oncancel={() => { deleteTarget = null; }}
/>
