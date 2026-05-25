<script lang="ts">
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { Search } from 'lucide-svelte';
	import type { ListResult } from 'pocketbase';

	type Conv = {
		id: string;
		contact: string;
		channel: string;
		direction: string;
		content: string;
		session_id: string;
		created: string;
		expand?: { contact?: { id: string; name: string; email: string } };
	};

	let result = $state<ListResult<Conv> | null>(null);
	let loading = $state(true);
	let filterChannel = $state('');
	let filterDirection = $state('');
	let page = $state(1);
	const perPage = 30;

	async function fetchConversations() {
		loading = true;
		try {
			const filters: string[] = [];
			if (filterChannel) filters.push(`channel = '${filterChannel}'`);
			if (filterDirection) filters.push(`direction = '${filterDirection}'`);
			result = await pb.collection('conversations').getList<Conv>(page, perPage, {
				filter: filters.join(' && ') || undefined,
				sort: '-created',
				expand: 'contact',
				fields: 'id,contact,channel,direction,content,session_id,created,expand',
			});
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al cargar conversaciones');
		} finally {
			loading = false;
		}
	}

	onMount(fetchConversations);

	$effect(() => {
		filterChannel; filterDirection; page;
		fetchConversations();
	});

	const channelLabels: Record<string, string> = {
		whatsapp: 'WhatsApp', telegram: 'Telegram', email: 'Email', web: 'Web',
	};

	const channelColors: Record<string, string> = {
		whatsapp: 'bg-emerald-900/50 text-emerald-300',
		telegram: 'bg-blue-900/50 text-blue-300',
		email: 'bg-violet-900/50 text-violet-300',
		web: 'bg-slate-700 text-slate-300',
	};

	function truncate(str: string, n = 120): string {
		return str.length > n ? str.slice(0, n) + '…' : str;
	}
</script>

<svelte:head><title>Conversaciones — Hermes CRM</title></svelte:head>

<div class="flex-1 p-6">
	<!-- Header -->
	<div class="mb-5 flex items-center justify-between">
		<div>
			<h1 class="text-xl font-semibold text-slate-100">Conversaciones</h1>
			<p class="text-sm text-slate-400">
				{result ? `${result.totalItems.toLocaleString()} mensajes registrados` : '…'}
			</p>
		</div>
	</div>

	<!-- Filters -->
	<div class="mb-4 flex flex-wrap gap-3">
		<select
			bind:value={filterChannel}
			class="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-500"
		>
			<option value="">Todos los canales</option>
			<option value="whatsapp">WhatsApp</option>
			<option value="telegram">Telegram</option>
			<option value="email">Email</option>
			<option value="web">Web</option>
		</select>
		<select
			bind:value={filterDirection}
			class="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-500"
		>
			<option value="">Entrantes y salientes</option>
			<option value="inbound">Entrantes</option>
			<option value="outbound">Salientes (Hermes)</option>
		</select>
	</div>

	<!-- List -->
	<div class="space-y-2">
		{#if loading && !result}
			<div class="flex items-center gap-2 py-4 text-sm text-slate-400">
				<div class="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500"></div>
				Cargando…
			</div>
		{:else if result && result.items.length === 0}
			<div class="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-500">
				Sin conversaciones aún — Hermes las registrará automáticamente via post-hook
			</div>
		{:else if result}
			{#each result.items as conv (conv.id)}
				<div class="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 hover:border-slate-700 transition-colors">
					<div class="mb-1.5 flex items-center gap-2 flex-wrap">
						<!-- Channel badge -->
						<span class="rounded px-1.5 py-0.5 text-xs font-medium {channelColors[conv.channel] ?? 'bg-slate-700 text-slate-300'}">
							{channelLabels[conv.channel] ?? conv.channel}
						</span>
						<!-- Direction -->
						<span class="text-xs font-medium {conv.direction === 'inbound' ? 'text-blue-400' : 'text-emerald-400'}">
							{conv.direction === 'inbound' ? '↙ Entrante' : '↗ Hermes'}
						</span>
						<!-- Contact -->
						{#if conv.expand?.contact}
							<a
								href="/contacts/{conv.expand.contact.id}"
								class="text-xs text-slate-400 hover:text-blue-400"
							>
								{conv.expand.contact.name || conv.expand.contact.email}
							</a>
						{/if}
						<!-- Time -->
						<span class="ml-auto text-xs text-slate-500">
							{new Date(conv.created).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
						</span>
					</div>
					<p class="text-sm text-slate-300 leading-relaxed">{truncate(conv.content)}</p>
				</div>
			{/each}

			<!-- Pagination -->
			{#if result.totalPages > 1}
				<div class="flex items-center justify-between pt-2">
					<span class="text-xs text-slate-500">Página {result.page} de {result.totalPages}</span>
					<div class="flex gap-2">
						<button
							onclick={() => { page = page - 1; }}
							disabled={page <= 1}
							class="rounded px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-40"
						>← Anterior</button>
						<button
							onclick={() => { page = page + 1; }}
							disabled={page >= result.totalPages}
							class="rounded px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-40"
						>Siguiente →</button>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>
