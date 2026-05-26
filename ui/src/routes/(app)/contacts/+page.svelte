<script lang="ts">
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { sanitizeSearch } from '$lib/utils';
	import { Sheet, Modal, Btn, Badge, Skeleton, Empty } from '$lib/ui';
	import ContactForm from '$lib/forms/ContactForm.svelte';
	import { UserPlus, Search, Pencil, Trash2, Users } from 'lucide-svelte';
	import type { ListResult } from 'pocketbase';

	type Contact = {
		id: string; name: string; email: string; phone: string;
		status: string; source: string; created: string;
	};

	// Data
	let result  = $state<ListResult<Contact> | null>(null);
	let loading = $state(true);
	let search  = $state('');
	let filterStatus = $state('');
	let page    = $state(1);
	const perPage = 25;

	// Sheet state
	let sheetOpen    = $state(false);
	let editingContact = $state<Contact | null>(null);

	// Delete state
	let deleteTarget = $state<Contact | null>(null);
	let deleting     = $state(false);

	// Debounced search
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
				// sanitizeSearch escapes \ and ' to prevent PocketBase filter injection.
				// See: https://pocketbase.io/docs/api-rules-and-filters/
				const q = sanitizeSearch(search);
				filters.push(`(name ~ '${q}' || email ~ '${q}' || phone ~ '${q}')`);
			}
			if (filterStatus) filters.push(`status = '${filterStatus}'`);
			result = await pb.collection('contacts').getList<Contact>(page, perPage, {
				filter: filters.join(' && ') || undefined,
				sort: '-created',
				fields: 'id,name,email,phone,status,source,created',
			});
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al cargar');
		} finally { loading = false; }
	}

	onMount(fetchContacts);
	$effect(() => { filterStatus; page; fetchContacts(); });

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
		web: 'Web', referral: 'Referido', email: 'Email', other: 'Otro',
	};
</script>

<svelte:head><title>Contactos — Hermes CRM</title></svelte:head>

<div class="flex-1 p-5 md:p-6">
	<!-- Header -->
	<div class="mb-5 flex items-center justify-between">
		<div>
			<h1>Contactos</h1>
			<p class="mt-0.5 text-sm text-slate-400">
				{result ? `${result.totalItems.toLocaleString()} contactos` : '…'}
			</p>
		</div>
		<Btn variant="primary" onclick={openCreate}>
			{#snippet icon()}<UserPlus class="h-4 w-4" />{/snippet}
			Nuevo contacto
		</Btn>
	</div>

	<!-- Filters -->
	<div class="mb-4 flex flex-wrap gap-3">
		<div class="relative min-w-52 flex-1">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
			<input
				type="search"
				placeholder="Buscar por nombre, email o teléfono…"
				bind:value={search}
				oninput={onSearchInput}
				class="w-full rounded-lg border border-slate-700 bg-slate-800/60 py-2 pl-9 pr-3 text-sm
					text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
			/>
		</div>
		<select
			bind:value={filterStatus}
			class="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-500"
		>
			<option value="">Todos los estados</option>
			<option value="lead">Lead</option>
			<option value="prospect">Prospect</option>
			<option value="customer">Cliente</option>
			<option value="churned">Perdido</option>
			<option value="inactive">Inactivo</option>
		</select>
	</div>

	<!-- Table / Skeleton / Empty -->
	<div class="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
		{#if loading && !result}
			<div class="p-5"><Skeleton rows={6} /></div>
		{:else if result && result.items.length === 0}
			<Empty
				title={search || filterStatus ? 'Sin resultados' : 'Sin contactos aún'}
				description={search || filterStatus ? 'Prueba con otro filtro' : 'Crea tu primer contacto para empezar'}
			>
				{#snippet icon()}<Users class="h-5 w-5" />{/snippet}
				{#snippet action()}
					{#if !search && !filterStatus}
						<Btn variant="primary" onclick={openCreate}>
							{#snippet icon()}<UserPlus class="h-4 w-4" />{/snippet}
							Crear primer contacto
						</Btn>
					{/if}
				{/snippet}
			</Empty>
		{:else if result}
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-slate-800">
						<th class="px-4 py-3 text-left text-xs font-medium text-slate-400">Nombre</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-slate-400 hidden sm:table-cell">Email</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-slate-400 hidden md:table-cell">Teléfono</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-slate-400">Estado</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-slate-400 hidden lg:table-cell">Fuente</th>
						<th class="px-4 py-3 text-right text-xs font-medium text-slate-400">Acciones</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-800">
					{#each result.items as c (c.id)}
						<tr class="group hover:bg-slate-800/40 transition-colors">
							<td class="px-4 py-3">
								<a href="/contacts/{c.id}" class="flex items-center gap-3 hover:text-blue-400">
									<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600/40 to-violet-600/40 text-xs font-semibold text-slate-200">
										{(c.name || c.email || '?')[0].toUpperCase()}
									</div>
									<span class="font-medium text-slate-200 group-hover:text-blue-400 transition-colors">
										{c.name || '—'}
									</span>
								</a>
							</td>
							<td class="px-4 py-3 text-slate-400 hidden sm:table-cell">{c.email || '—'}</td>
							<td class="px-4 py-3 text-slate-400 hidden md:table-cell">{c.phone || '—'}</td>
							<td class="px-4 py-3">
								{#if c.status}
									<Badge variant={statusBadge[c.status] ?? 'slate'}>
										{statusLabel[c.status] ?? c.status}
									</Badge>
								{:else}
									<span class="text-slate-600">—</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-slate-400 hidden lg:table-cell">
								{sourceLabel[c.source] ?? c.source ?? '—'}
							</td>
							<td class="px-4 py-3 text-right">
								<div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
									<button
										onclick={(e) => openEdit(c, e)}
										class="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
										title="Editar"
									>
										<Pencil class="h-3.5 w-3.5" />
									</button>
									<button
										onclick={(e) => { e.stopPropagation(); deleteTarget = c; }}
										class="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-900/40 hover:text-red-400"
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
				<div class="flex items-center justify-between border-t border-slate-800 px-4 py-3">
					<span class="text-xs text-slate-500">Página {result.page} de {result.totalPages}</span>
					<div class="flex gap-2">
						<Btn variant="ghost" size="sm" onclick={() => { page = page - 1; }} disabled={page <= 1}>
							← Anterior
						</Btn>
						<Btn variant="ghost" size="sm" onclick={() => { page = page + 1; }} disabled={page >= result.totalPages}>
							Siguiente →
						</Btn>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>

<!-- Create / Edit Sheet -->
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

<!-- Delete Confirm Modal -->
<Modal
	open={!!deleteTarget}
	title="Eliminar contacto"
	message="¿Seguro que deseas eliminar a {deleteTarget?.name || 'este contacto'}? Se eliminarán también sus deals, tareas y notas relacionadas."
	confirmLabel="Eliminar"
	variant="danger"
	loading={deleting}
	onconfirm={confirmDelete}
	oncancel={() => { deleteTarget = null; }}
/>
