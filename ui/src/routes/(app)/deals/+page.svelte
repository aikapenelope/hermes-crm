<script lang="ts">
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { Plus } from 'lucide-svelte';

	type Deal = {
		id: string;
		title: string;
		value: number;
		currency: string;
		stage: string;
		probability: number;
		expected_close: string;
		expand?: { contact?: { id: string; name: string; email: string } };
	};

	const stages = [
		{ id: 'lead',        label: 'Lead',        color: 'border-slate-600'  },
		{ id: 'qualified',   label: 'Calificado',  color: 'border-blue-600'   },
		{ id: 'proposal',    label: 'Propuesta',   color: 'border-amber-600'  },
		{ id: 'negotiation', label: 'Negociación', color: 'border-orange-600' },
		{ id: 'won',         label: 'Ganado',      color: 'border-emerald-600'},
		{ id: 'lost',        label: 'Perdido',     color: 'border-rose-600'   },
	];

	let deals = $state<Deal[]>([]);
	let loading = $state(true);
	let movingId = $state<string | null>(null);

	onMount(async () => {
		try {
			deals = await pb.collection('deals').getFullList<Deal>({
				sort: '-created',
				expand: 'contact',
				fields: 'id,title,value,currency,stage,probability,expected_close,expand',
			});
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al cargar negocios');
		} finally {
			loading = false;
		}
	});

	const byStage = $derived(
		Object.fromEntries(
			stages.map((s) => [s.id, deals.filter((d) => d.stage === s.id)])
		) as Record<string, Deal[]>
	);

	const stageTotal = $derived(
		Object.fromEntries(
			stages.map((s) => [
				s.id,
				byStage[s.id]?.reduce((sum, d) => sum + (d.value ?? 0), 0) ?? 0,
			])
		) as Record<string, number>
	);

	async function moveToStage(deal: Deal, newStage: string) {
		if (deal.stage === newStage) return;
		movingId = deal.id;
		try {
			await pb.collection('deals').update(deal.id, { stage: newStage });
			deals = deals.map((d) => d.id === deal.id ? { ...d, stage: newStage } : d);
			toast.success(`Negocio movido a ${stages.find(s => s.id === newStage)?.label}`);
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al mover negocio');
		} finally {
			movingId = null;
		}
	}

	const currencySymbols: Record<string, string> = {
		USD: '$', COP: 'COP$', EUR: '€', MXN: 'MX$', BRL: 'R$', ARS: 'AR$',
	};

	function formatValue(value: number, currency: string) {
		return `${currencySymbols[currency] ?? ''} ${value?.toLocaleString() ?? 0}`;
	}

	function isOverdue(expectedClose: string): boolean {
		if (!expectedClose) return false;
		return new Date(expectedClose) < new Date();
	}
</script>

<svelte:head><title>Negocios — Hermes CRM</title></svelte:head>

<div class="flex flex-col h-full">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-slate-800 px-6 py-4 shrink-0">
		<div>
			<h1 class="text-xl font-semibold text-slate-100">Negocios</h1>
			<p class="text-sm text-slate-400">{deals.length} negocios en el pipeline</p>
		</div>
		<button
			onclick={() => toast.info('Crear negocio — próximamente')}
			class="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
		>
			<Plus class="h-4 w-4" /> Nuevo negocio
		</button>
	</div>

	{#if loading}
		<div class="flex items-center gap-2 p-6 text-sm text-slate-400">
			<div class="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500"></div>
			Cargando pipeline…
		</div>
	{:else}
		<!-- Kanban board — horizontal scroll on small screens -->
		<div class="flex-1 overflow-x-auto p-4">
			<div class="flex gap-3 h-full" style="min-width: max-content;">
				{#each stages as stage}
					{@const stageDeal = byStage[stage.id] ?? []}
					<div class="flex w-64 shrink-0 flex-col rounded-xl border border-slate-800 bg-slate-900/60">
						<!-- Column header -->
						<div class="border-b border-slate-800 px-3 py-2.5 flex items-center gap-2">
							<div class="h-2 w-2 rounded-full border-2 {stage.color}"></div>
							<span class="text-sm font-medium text-slate-200">{stage.label}</span>
							<span class="ml-auto text-xs text-slate-500">{stageDeal.length}</span>
						</div>
						<!-- Column value total -->
						{#if stageTotal[stage.id] > 0}
							<div class="border-b border-slate-800/50 px-3 py-1.5">
								<span class="text-xs font-medium text-slate-400">
									Total: {stageDeal[0]?.currency ? formatValue(stageTotal[stage.id], stageDeal[0].currency) : stageTotal[stage.id].toLocaleString()}
								</span>
							</div>
						{/if}
						<!-- Deal cards -->
						<div class="flex-1 overflow-y-auto p-2 space-y-2">
							{#if stageDeal.length === 0}
								<div class="py-6 text-center text-xs text-slate-600">Sin negocios</div>
							{:else}
								{#each stageDeal as deal (deal.id)}
									<div
										class="rounded-lg border border-slate-700 bg-slate-900 p-3 hover:border-slate-600 transition-colors
											{movingId === deal.id ? 'opacity-50' : ''}"
									>
										<p class="mb-1 text-sm font-medium text-slate-100 leading-snug">{deal.title}</p>
										{#if deal.expand?.contact}
											<a
												href="/contacts/{deal.expand.contact.id}"
												class="text-xs text-blue-400 hover:text-blue-300"
											>
												{deal.expand.contact.name || deal.expand.contact.email}
											</a>
										{/if}
										<div class="mt-2 flex items-center justify-between">
											<span class="text-xs font-semibold text-emerald-400">
												{formatValue(deal.value, deal.currency)}
											</span>
											{#if deal.expected_close}
												<span class="text-xs {isOverdue(deal.expected_close) && stage.id !== 'won' && stage.id !== 'lost' ? 'text-rose-400' : 'text-slate-500'}">
													{deal.expected_close.slice(0, 10)}
												</span>
											{/if}
										</div>
										<!-- Move to stage -->
										{#if stage.id !== 'won' && stage.id !== 'lost'}
											<div class="mt-2 flex gap-1 flex-wrap">
												{#each stages.filter(s => s.id !== deal.stage) as s}
													<button
														onclick={() => moveToStage(deal, s.id)}
														disabled={movingId === deal.id}
														class="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors disabled:opacity-40"
													>→ {s.label}</button>
												{/each}
											</div>
										{/if}
									</div>
								{/each}
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
