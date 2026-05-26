<script lang="ts">
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { BarChart2 } from 'lucide-svelte';

	const segments = [
		{
			id: 'seg_hot_leads',
			label: '🔥 Hot Leads',
			description: 'Negocios en propuesta o negociación con sus contactos',
			columns: ['name', 'email', 'deal_title', 'deal_value', 'deal_stage', 'expected_close'],
		},
		{
			id: 'seg_pipeline_at_risk',
			label: '⚠️ Pipeline en Riesgo',
			description: 'Negocios con fecha de cierre vencida y no ganados/perdidos',
			columns: ['title', 'value', 'currency', 'stage', 'expected_close', 'days_overdue'],
		},
		{
			id: 'seg_cold_contacts',
			label: '❄️ Contactos Fríos',
			description: 'Contactos sin actividad en más de 30 días con negocios abiertos',
			columns: ['name', 'email', 'phone', 'last_contacted'],
		},
		{
			id: 'seg_revenue_by_source',
			label: '💰 Ingresos por Fuente',
			description: 'Ingresos ganados agrupados por canal de origen',
			columns: ['source', 'total_contacts', 'total_deals', 'deals_won', 'revenue_won'],
		},
		{
			id: 'seg_won_by_owner',
			label: '🏆 Ganados por Asesor',
			description: 'Negocios ganados agrupados por responsable',
			columns: ['owner_name', 'owner_email', 'deals_won', 'revenue_won', 'contacts_owned'],
		},
	];

	type SegData = {
		id: string;
		rows: Record<string, unknown>[];
		loading: boolean;
		error: string | null;
	};

	let segData = $state<Record<string, SegData>>(
		Object.fromEntries(
			segments.map((s) => [s.id, { id: s.id, rows: [], loading: true, error: null }])
		)
	);

	onMount(async () => {
		await Promise.all(
			segments.map(async (seg) => {
				try {
					const items = await pb.collection(seg.id).getFullList({ perPage: 50 });
					segData[seg.id] = { ...segData[seg.id], rows: items as Record<string, unknown>[], loading: false };
				} catch (e: unknown) {
					segData[seg.id] = {
						...segData[seg.id],
						loading: false,
						error: e instanceof Error ? e.message : 'Error',
					};
				}
			})
		);
	});

	function fmt(val: unknown): string {
		if (val === null || val === undefined || val === '') return '—';
		if (typeof val === 'number') return val.toLocaleString('es', { maximumFractionDigits: 2 });
		if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) return val.slice(0, 10);
		return String(val);
	}
</script>

<svelte:head><title>Segmentos — Hermes CRM</title></svelte:head>

<div class="flex-1 p-6 space-y-6">
	<div>
		<h1 class="text-xl font-semibold text-white">Segmentos</h1>
		<p class="text-sm text-[#888]">Vistas inteligentes calculadas en tiempo real</p>
	</div>

	{#each segments as seg}
		{@const data = segData[seg.id]}
		<div class="border border-[#1a1a1a] bg-[#090909] overflow-hidden">
			<div class="flex items-start gap-3 border-b border-[#1a1a1a] px-4 py-3">
				<BarChart2 class="mt-0.5 h-4 w-4 shrink-0 text-[#888]" />
				<div>
					<h2 class="text-sm font-semibold text-white">{seg.label}</h2>
					<p class="text-xs text-[#555]">{seg.description}</p>
				</div>
				{#if !data.loading}
					<span class="ml-auto shrink-0 text-xs text-[#555]">{data.rows.length} registros</span>
				{/if}
			</div>

			{#if data.loading}
				<div class="flex items-center gap-2 p-4 text-sm text-[#888]">
					<div class="h-3.5 w-3.5 animate-spin rounded-full border border-[#333] border-t-white"></div>
					Calculando…
				</div>
			{:else if data.error}
				<p class="p-4 text-sm text-rose-400">{data.error}</p>
			{:else if data.rows.length === 0}
				<p class="p-4 text-sm text-[#555]">Sin registros en este segmento</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-[#1a1a1a]">
								{#each seg.columns as col}
									<th class="px-4 py-2 text-left text-xs font-medium text-[#555] capitalize">
										{col.replace(/_/g, ' ')}
									</th>
								{/each}
							</tr>
						</thead>
						<tbody class="divide-y divide-[#111]">
							{#each data.rows as row (row.id)}
								<tr class="hover:bg-[#0d0d0d] transition-colors">
									{#each seg.columns as col}
										<td class="px-4 py-2 text-[#ccc]">{fmt(row[col])}</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/each}
</div>
