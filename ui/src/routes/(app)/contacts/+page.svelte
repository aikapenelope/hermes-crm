<script lang="ts">
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { UserPlus, Search } from 'lucide-svelte';
	import type { ListResult } from 'pocketbase';

	type Contact = {
		id: string;
		name: string;
		email: string;
		phone: string;
		status: string;
		source: string;
		created: string;
	};

	let result = $state<ListResult<Contact> | null>(null);
	let loading = $state(true);
	let search = $state('');
	let filterStatus = $state('');
	let page = $state(1);
	const perPage = 20;

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
				filters.push(`(name ~ '${search}' || email ~ '${search}' || phone ~ '${search}')`);
			}
			if (filterStatus) filters.push(`status = '${filterStatus}'`);
			result = await pb.collection('contacts').getList<Contact>(page, perPage, {
				filter: filters.join(' && ') || undefined,
				sort: '-created',
				fields: 'id,name,email,phone,status,source,created',
			});
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al cargar contactos');
		} finally {
			loading = false;
		}
	}

	onMount(fetchContacts);

	$effect(() => {
		// Re-fetch when filter changes
		filterStatus;
		page;
		fetchContacts();
	});

	const statusColors: Record<string, string> = {
		lead: 'bg-slate-700 text-slate-300',
		prospect: 'bg-blue-900/50 text-blue-300',
		customer: 'bg-emerald-900/50 text-emerald-300',
		churned: 'bg-rose-900/50 text-rose-300',
		inactive: 'bg-slate-700 text-slate-400',
	};

	const sourceLabels: Record<string, string> = {
		manual: 'Manual', whatsapp: 'WhatsApp', instagram: 'Instagram',
		web: 'Web', referral: 'Referido', email: 'Email', other: 'Otro',
	};
</script>

<svelte:head><title>Contactos — Hermes CRM</title></svelte:head>

<div class="flex-1 p-6">
	<!-- Header -->
	<div class="mb-5 flex items-center justify-between">
		<div>
			<h1 class="text-xl font-semibold text-slate-100">Contactos</h1>
			<p class="text-sm text-slate-400">
				{result ? `${result.totalItems.toLocaleString()} contactos` : '…'}
			</p>
		</div>
		<a
			href="/contacts/new"
			class="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
		>
			<UserPlus class="h-4 w-4" /> Nuevo
		</a>
	</div>

	<!-- Filters -->
	<div class="mb-4 flex flex-wrap gap-3">
		<div class="relative flex-1 min-w-48">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
			<input
				type="search"
				placeholder="Buscar por nombre, email o teléfono…"
				bind:value={search}
				oninput={onSearchInput}
				class="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm
					text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500"
			/>
		</div>
		<select
			bind:value={filterStatus}
			class="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-500"
		>
			<option value="">Todos los estados</option>
			<option value="lead">Lead</option>
			<option value="prospect">Prospect</option>
			<option value="customer">Cliente</option>
			<option value="churned">Perdido</option>
			<option value="inactive">Inactivo</option>
		</select>
	</div>

	<!-- Table -->
	<div class="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
		{#if loading && !result}
			<div class="flex items-center gap-2 p-8 text-sm text-slate-400">
				<div class="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500"></div>
				Cargando…
			</div>
		{:else if result && result.items.length === 0}
			<div class="p-8 text-center text-sm text-slate-500">
				{search || filterStatus ? 'Sin resultados para los filtros aplicados' : 'Sin contactos aún'}
			</div>
		{:else if result}
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-slate-800">
						<th class="px-4 py-3 text-left text-xs font-medium text-slate-400">Nombre</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-slate-400 hidden md:table-cell">Email</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-slate-400 hidden lg:table-cell">Teléfono</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-slate-400">Estado</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-slate-400 hidden lg:table-cell">Fuente</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-800">
					{#each result.items as c (c.id)}
						<tr class="hover:bg-slate-800/40 transition-colors">
							<td class="px-4 py-3">
								<a href="/contacts/{c.id}" class="flex items-center gap-3 hover:text-blue-400">
									<div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-300">
										{(c.name || c.email || '?')[0].toUpperCase()}
									</div>
									<span class="font-medium text-slate-200">{c.name || '—'}</span>
								</a>
							</td>
							<td class="px-4 py-3 text-slate-400 hidden md:table-cell">{c.email || '—'}</td>
							<td class="px-4 py-3 text-slate-400 hidden lg:table-cell">{c.phone || '—'}</td>
							<td class="px-4 py-3">
								{#if c.status}
									<span class="rounded px-1.5 py-0.5 text-xs font-medium {statusColors[c.status] ?? 'bg-slate-700 text-slate-400'}">
										{c.status}
									</span>
								{:else}
									<span class="text-slate-600">—</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-slate-400 hidden lg:table-cell">
								{sourceLabels[c.source] ?? c.source ?? '—'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<!-- Pagination -->
			{#if result.totalPages > 1}
				<div class="flex items-center justify-between border-t border-slate-800 px-4 py-3">
					<span class="text-xs text-slate-500">
						Página {result.page} de {result.totalPages}
					</span>
					<div class="flex gap-2">
						<button
							onclick={() => { page = page - 1; }}
							disabled={page <= 1}
							class="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-40"
						>← Anterior</button>
						<button
							onclick={() => { page = page + 1; }}
							disabled={page >= result.totalPages}
							class="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-40"
						>Siguiente →</button>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>
