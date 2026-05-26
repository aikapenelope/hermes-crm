<script lang="ts">
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { Skeleton, Empty } from '$lib/ui';
	import { Mail, Search } from 'lucide-svelte';
	import type { ListResult } from 'pocketbase';
	import { sanitizeSearch } from '$lib/utils';

	type EmailEntry = {
		id: string;
		subject: string;
		sender: string;
		sender_name: string;
		received: string;
		direction: 'inbound' | 'outbound';
		thread_id: string;
	};

	let result       = $state<ListResult<EmailEntry> | null>(null);
	let loading      = $state(true);
	let search       = $state('');
	let filterDir    = $state('');
	let page         = $state(1);
	const perPage    = 30;
	let debounceTimer: ReturnType<typeof setTimeout>;

	async function fetchEmails() {
		loading = true;
		try {
			const filters: string[] = [];
			if (search.trim()) {
				const q = sanitizeSearch(search);
				filters.push(`(subject ~ '${q}' || sender ~ '${q}' || sender_name ~ '${q}')`);
			}
			if (filterDir) filters.push(`direction = '${filterDir}'`);
			result = await pb.collection('email_log').getList<EmailEntry>(page, perPage, {
				filter: filters.join(' && ') || undefined,
				sort:   '-received',
			});
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al cargar emails');
		} finally { loading = false; }
	}

	onMount(fetchEmails);
	$effect(() => { filterDir; page; fetchEmails(); });

	function onSearchInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => { page = 1; fetchEmails(); }, 350);
	}

	function formatDate(d: string) {
		const dt = new Date(d);
		const today = new Date();
		const isToday = dt.toDateString() === today.toDateString();
		return isToday
			? dt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
			: dt.toLocaleDateString('es', { day: '2-digit', month: 'short' });
	}
</script>

<svelte:head><title>Emails — Hermes CRM</title></svelte:head>

<div class="flex-1 p-5 md:p-6">
	<div class="mb-5 flex items-center justify-between">
		<div>
			<h1>Emails</h1>
			<p class="mt-0.5 text-sm text-[#888]">
				{result ? `${result.totalItems.toLocaleString()} mensajes registrados` : '…'}
				— sincronizado por Hermes
			</p>
		</div>
	</div>

	<!-- Filters -->
	<div class="mb-4 flex flex-wrap gap-3">
		<div class="relative min-w-52 flex-1">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#555]" />
			<input
				type="search"
				placeholder="Buscar por asunto o remitente…"
				bind:value={search}
				oninput={onSearchInput}
				class="w-full rounded-lg border border-[#222] bg-transparent py-2 pl-9 pr-3 text-sm
					text-white placeholder-[#444] outline-none focus:border-white"
			/>
		</div>
		<select
			bind:value={filterDir}
			class="rounded-lg border border-[#222] bg-transparent px-3 py-2 text-sm text-[#ccc] outline-none focus:border-white"
		>
			<option value="">Todos</option>
			<option value="inbound">Recibidos</option>
			<option value="outbound">Enviados</option>
		</select>
	</div>

	<!-- List -->
	<div class="overflow-hidden border border-[#1a1a1a] bg-[#090909]">
		{#if loading && !result}
			<div class="p-5"><Skeleton rows={8} /></div>
		{:else if result && result.items.length === 0}
			<Empty
				title={search || filterDir ? 'Sin resultados' : 'Sin emails aún'}
				description={search || filterDir
					? 'Prueba con otro filtro'
					: 'Hermes sincronizará tu Gmail cuando el cron job esté activo'}
			>
				{#snippet icon()}<Mail class="h-5 w-5" />{/snippet}
			</Empty>
		{:else if result}
			<ul class="divide-y divide-[#1a1a1a]">
				{#each result.items as email (email.id)}
					<li class="flex items-center gap-4 px-4 py-3 hover:bg-[#111] transition-colors">
						<!-- Direction indicator -->
						<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full
							{email.direction === 'inbound' ? 'bg-[#111]' : 'bg-emerald-900/40'}">
							<Mail class="h-4 w-4 {email.direction === 'inbound' ? 'text-[#888]' : 'text-emerald-400'}" />
						</div>

						<!-- Subject + sender -->
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-white">{email.subject || '(sin asunto)'}</p>
							<p class="truncate text-xs text-[#555]">
								{#if email.sender_name}
									{email.sender_name} &lt;{email.sender}&gt;
								{:else}
									{email.sender}
								{/if}
							</p>
						</div>

						<!-- Date -->
						<span class="shrink-0 text-xs text-[#555]" title={email.received}>
							{formatDate(email.received)}
						</span>
					</li>
				{/each}
			</ul>

			<!-- Pagination -->
			{#if result.totalPages > 1}
				<div class="flex items-center justify-between border-t border-[#1a1a1a] px-4 py-3">
					<span class="text-xs text-[#555]">Página {result.page} de {result.totalPages}</span>
					<div class="flex gap-2">
						<button onclick={() => { page = page - 1; }} disabled={page <= 1}
							class="rounded px-2 py-1 text-xs text-[#555] hover:bg-[#111] disabled:opacity-40">
							← Anterior
						</button>
						<button onclick={() => { page = page + 1; }} disabled={page >= result.totalPages}
							class="rounded px-2 py-1 text-xs text-[#555] hover:bg-[#111] disabled:opacity-40">
							Siguiente →
						</button>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>
