<script lang="ts">
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { Badge, Skeleton } from '$lib/ui';
	import { TrendingUp } from 'lucide-svelte';

	type Deal = {
		id: string; title: string; value: number; currency: string;
		stage: string; probability: number; expected_close: string;
		expand?: { contact?: { name: string } };
	};

	let deals   = $state<Deal[]>([]);
	let loading = $state(true);
	let viewMode = $state<'weighted' | 'full'>('weighted');

	onMount(async () => {
		try {
			deals = await pb.collection('deals').getFullList<Deal>({
				filter: "stage != 'won' && stage != 'lost' && expected_close != ''",
				sort: 'expected_close',
				fields: 'id,title,value,currency,stage,probability,expected_close,expand',
				expand: 'contact',
			});
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al cargar');
		} finally { loading = false; }
	});

	// ── Group by month ────────────────────────────────────────────────────────
	type MonthGroup = {
		key: string;          // 'YYYY-MM'
		label: string;        // 'MAYO 2026'
		deals: Deal[];
		total: number;        // full value
		weighted: number;     // probability-weighted
		byStage: Record<string, number>;
	};

	const MONTH_NAMES = [
		'ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
		'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE',
	];

	const grouped = $derived((): MonthGroup[] => {
		const map = new Map<string, MonthGroup>();

		for (const d of deals) {
			const key = d.expected_close.slice(0, 7);
			const [y, m] = key.split('-').map(Number);
			const label = `${MONTH_NAMES[m - 1]} ${y}`;

			if (!map.has(key)) {
				map.set(key, { key, label, deals: [], total: 0, weighted: 0, byStage: {} });
			}
			const g = map.get(key)!;
			g.deals.push(d);
			g.total    += d.value ?? 0;
			g.weighted += (d.value ?? 0) * ((d.probability ?? 50) / 100);
			g.byStage[d.stage] = (g.byStage[d.stage] ?? 0) + (d.value ?? 0);
		}

		return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
	});

	const grandTotal   = $derived(grouped().reduce((s, g) => s + g.total, 0));
	const grandWeighted = $derived(grouped().reduce((s, g) => s + g.weighted, 0));

	function fmt(v: number, c = 'USD') {
		return `${c} ${Math.round(v).toLocaleString('es', { maximumFractionDigits: 0 })}`;
	}

	const stageDot: Record<string, string> = {
		lead: 'bg-[#444]', qualified: 'bg-white', proposal: 'bg-amber-400',
		negotiation: 'bg-orange-400', won: 'bg-emerald-500', lost: 'bg-rose-500',
	};
	const stageColors: Record<string, 'slate' | 'blue' | 'amber' | 'orange' | 'green' | 'red'> = {
		lead: 'slate', qualified: 'blue', proposal: 'amber',
		negotiation: 'orange', won: 'green', lost: 'red',
	};
</script>

<svelte:head><title>Forecast — Hermes CRM</title></svelte:head>

<div class="flex-1 p-5 md:p-6 uppercase tracking-widest" style="font-size:11px;">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<div>
			<div class="text-[9px] text-[#444]">ANALYTICS // FORECAST</div>
			<h1 class="mt-1 font-sans text-xl font-bold text-white" style="letter-spacing:-0.02em; text-transform:none;">
				Proyección de ingresos
			</h1>
		</div>
		<div class="flex border border-[#222]">
			<button
				onclick={() => { viewMode = 'weighted'; }}
				class="px-3 py-1.5 text-[9px] tracking-widest uppercase transition-colors
					{viewMode === 'weighted' ? 'bg-white text-black' : 'text-[#555] hover:text-white'}"
			>PONDERADO</button>
			<button
				onclick={() => { viewMode = 'full'; }}
				class="border-l border-[#222] px-3 py-1.5 text-[9px] tracking-widest uppercase transition-colors
					{viewMode === 'full' ? 'bg-white text-black' : 'text-[#555] hover:text-white'}"
			>TOTAL</button>
		</div>
	</div>

	{#if loading}
		<Skeleton rows={6} />
	{:else if deals.length === 0}
		<div class="border border-[#1a1a1a] bg-[#090909] px-6 py-16 text-center">
			<TrendingUp class="mx-auto mb-3 h-8 w-8 text-[#2a2a2a]" />
			<div class="text-[#333]">SIN DEALS CON FECHA DE CIERRE</div>
			<div class="mt-1 text-[9px] text-[#2a2a2a]">Agrega expected_close a tus deals para ver el forecast</div>
		</div>
	{:else}
		<!-- Summary row -->
		<div class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
			<div class="border border-[#1a1a1a] bg-[#090909] p-4">
				<div class="text-[9px] text-[#444]">DEALS ACTIVOS</div>
				<div class="mt-1 text-2xl font-bold text-white" style="font-family:system-ui;">{deals.length}</div>
			</div>
			<div class="border border-[#1a1a1a] bg-[#090909] p-4">
				<div class="text-[9px] text-[#444]">MESES CON DEALS</div>
				<div class="mt-1 text-2xl font-bold text-white" style="font-family:system-ui;">{grouped().length}</div>
			</div>
			<div class="border border-[#1a1a1a] bg-[#090909] p-4">
				<div class="text-[9px] text-[#444]">PIPELINE TOTAL</div>
				<div class="mt-1 text-base font-bold text-white" style="font-family:system-ui;">
					{fmt(grandTotal, deals[0]?.currency)}
				</div>
			</div>
			<div class="border border-[#1a1a1a] bg-[#090909] p-4">
				<div class="text-[9px] text-[#444]">FORECAST PONDERADO</div>
				<div class="mt-1 text-base font-bold text-emerald-500" style="font-family:system-ui;">
					{fmt(grandWeighted, deals[0]?.currency)}
				</div>
			</div>
		</div>

		<!-- Ponderado note -->
		<div class="mb-5 text-[8px] text-[#333]">
			PONDERADO = valor × probabilidad de cierre. TOTAL = valor completo sin ajuste.
		</div>

		<!-- Month groups -->
		<div class="space-y-4">
			{#each grouped() as group}
				<div class="border border-[#1a1a1a] bg-[#090909]">
					<!-- Month header -->
					<div class="flex items-center justify-between border-b border-[#1a1a1a] px-4 py-3">
						<div class="flex items-center gap-3">
							<span class="text-[10px] font-bold text-white">{group.label}</span>
							<span class="text-[9px] text-[#444]">{group.deals.length} DEALS</span>
						</div>
						<div class="flex items-center gap-4">
							{#if viewMode === 'weighted'}
								<div class="text-right">
									<div class="text-[8px] text-[#444]">FORECAST</div>
									<div class="text-[11px] font-bold text-emerald-500">
										{fmt(group.weighted, group.deals[0]?.currency)}
									</div>
								</div>
							{:else}
								<div class="text-right">
									<div class="text-[8px] text-[#444]">TOTAL</div>
									<div class="text-[11px] font-bold text-white">
										{fmt(group.total, group.deals[0]?.currency)}
									</div>
								</div>
							{/if}
						</div>
					</div>

					<!-- Deal rows -->
					<div class="divide-y divide-[#0d0d0d]">
						{#each group.deals as d}
							<div class="flex items-center justify-between px-4 py-2.5">
								<div class="flex items-center gap-2.5 min-w-0">
									<div class="h-1.5 w-1.5 shrink-0 rounded-full {stageDot[d.stage] ?? 'bg-[#333]'}"></div>
									<span class="normal-case text-[11px] text-[#888] truncate" style="letter-spacing:0;">{d.title}</span>
									{#if d.expand?.contact}
										<span class="hidden text-[9px] text-[#444] lg:inline">— {d.expand.contact.name}</span>
									{/if}
								</div>
								<div class="flex items-center gap-3 shrink-0">
									<span class="text-[9px] text-[#444]">{d.probability ?? 50}%</span>
									<Badge variant={stageColors[d.stage] ?? 'slate'} size="sm">{d.stage}</Badge>
									<span class="text-[10px] {viewMode === 'weighted' ? 'text-emerald-500' : 'text-white'} font-bold w-28 text-right" style="font-family:system-ui;">
										{viewMode === 'weighted'
											? fmt((d.value ?? 0) * ((d.probability ?? 50) / 100), d.currency)
											: fmt(d.value ?? 0, d.currency)}
									</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
