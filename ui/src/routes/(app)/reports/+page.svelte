<script lang="ts">
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { Skeleton, Empty, Badge } from '$lib/ui';
	import { FileText } from 'lucide-svelte';
	import type { ListResult } from 'pocketbase';

	type Report = {
		id: string;
		title: string;
		content: string;
		type: 'cron' | 'manual' | 'email_summary' | 'hermes';
		status: 'success' | 'info' | 'warning' | 'error';
		session_id: string;
		created: string;
	};

	let result     = $state<ListResult<Report> | null>(null);
	let loading    = $state(true);
	let filterType = $state('');
	let page       = $state(1);
	const perPage  = 20;

	// Expandable report content
	let expandedId = $state<string | null>(null);

	async function fetchReports() {
		loading = true;
		try {
			const filter = filterType ? `type = '${filterType}'` : undefined;
			result = await pb.collection('reports').getList<Report>(page, perPage, {
				filter, sort: '-created',
			});
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al cargar reportes');
		} finally { loading = false; }
	}

	onMount(fetchReports);
	$effect(() => { filterType; page; fetchReports(); });

	const typeLabel: Record<string, string> = {
		cron:          'Cron',
		manual:        'Manual',
		email_summary: 'Email',
		hermes:        'Hermes',
	};
	const typeBadge: Record<string, 'slate' | 'blue' | 'violet' | 'amber'> = {
		cron:          'slate',
		manual:        'slate',
		email_summary: 'violet',
		hermes:        'amber',
	};
	const statusBadge: Record<string, 'green' | 'slate' | 'amber' | 'red'> = {
		success: 'green',
		info:    'slate',
		warning: 'amber',
		error:   'red',
	};
	const statusDot: Record<string, string> = {
		success: 'bg-emerald-500',
		info:    'bg-white',
		warning: 'bg-amber-500',
		error:   'bg-red-500',
	};

	function formatDate(d: string) {
		return new Date(d).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
	}
</script>

<svelte:head><title>Reportes — Hermes CRM</title></svelte:head>

<div class="flex-1 p-5 md:p-6">
	<div class="mb-5 flex items-center justify-between">
		<div>
			<h1>Reportes</h1>
			<p class="mt-0.5 text-sm text-[#888]">
				{result ? `${result.totalItems} reportes` : '…'}
				— generados por Hermes automáticamente
			</p>
		</div>
	</div>

	<!-- Filter -->
	<div class="mb-4">
		<select
			bind:value={filterType}
			class="rounded-lg border border-[#222] bg-transparent px-3 py-2 text-sm text-[#ccc] outline-none focus:border-white"
		>
			<option value="">Todos los tipos</option>
			<option value="cron">Cron jobs</option>
			<option value="manual">Manuales</option>
			<option value="email_summary">Email summary</option>
			<option value="hermes">Hermes</option>
		</select>
	</div>

	<!-- Reports list -->
	{#if loading && !result}
		<Skeleton rows={6} />
	{:else if result && result.items.length === 0}
		<Empty
			title={filterType ? 'Sin reportes de ese tipo' : 'Sin reportes aún'}
			description={filterType
				? 'Prueba con otro filtro'
				: 'Los reportes aparecen aquí cuando Hermes completa sus tareas automáticas'}
		>
			{#snippet icon()}<FileText class="h-5 w-5" />{/snippet}
		</Empty>
	{:else if result}
		<div class="space-y-3">
			{#each result.items as report (report.id)}
				{@const isExpanded = expandedId === report.id}
				<div class="border border-[#1a1a1a] bg-[#090909] overflow-hidden">
					<!-- Header row -->
					<button
						onclick={() => { expandedId = isExpanded ? null : report.id; }}
						class="flex w-full items-center gap-3 px-4 py-3 text-left
							hover:bg-[#111] transition-colors"
					>
						<!-- Status dot -->
						<div class="h-2 w-2 shrink-0 rounded-full {statusDot[report.status] ?? 'bg-slate-500'}"></div>

						<!-- Title -->
						<p class="flex-1 min-w-0 truncate text-sm font-medium text-white">
							{report.title}
						</p>

						<!-- Badges -->
						<div class="flex shrink-0 items-center gap-2">
							<Badge variant={typeBadge[report.type] ?? 'slate'} size="sm">
								{typeLabel[report.type] ?? report.type}
							</Badge>
							<span class="text-xs text-[#555]">
								{formatDate(report.created)}
							</span>
							<!-- Expand indicator -->
							<span class="text-xs text-[#444] ml-1">
								{isExpanded ? '▲' : '▼'}
							</span>
						</div>
					</button>

					<!-- Expandable content -->
					{#if isExpanded && report.content}
						<div class="border-t border-[#1a1a1a] px-4 py-4">
							<p class="text-sm text-[#ccc] leading-relaxed whitespace-pre-wrap">
								{report.content}
							</p>
							{#if report.session_id}
								<p class="mt-3 font-mono text-xs text-[#444]">
									session: {report.session_id}
								</p>
							{/if}
						</div>
					{/if}
				</div>
			{/each}

			{#if result.totalPages > 1}
				<div class="flex items-center justify-between pt-2">
					<span class="text-xs text-[#555]">Página {result.page} de {result.totalPages}</span>
					<div class="flex gap-2">
						<button onclick={() => { page = page - 1; }} disabled={page <= 1}
							class="rounded px-3 py-1.5 text-xs text-[#555] hover:bg-[#111] disabled:opacity-40">
							← Anterior
						</button>
						<button onclick={() => { page = page + 1; }} disabled={page >= result.totalPages}
							class="rounded px-3 py-1.5 text-xs text-[#555] hover:bg-[#111] disabled:opacity-40">
							Siguiente →
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
