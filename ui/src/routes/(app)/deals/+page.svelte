<script lang="ts">
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { Sheet, Modal, Btn, Badge } from '$lib/ui';
	import DealForm from '$lib/forms/DealForm.svelte';
	import { Plus, Pencil, Trash2 } from 'lucide-svelte';

	type Deal = {
		id: string; title: string; value: number; currency: string;
		stage: string; probability: number; expected_close: string;
		description: string;
		expand?: { contact?: { id: string; name: string; email: string } };
	};

	const stages = [
		{ id: 'lead',        label: 'Lead',        color: 'bg-slate-500',   badge: 'slate'  },
		{ id: 'qualified',   label: 'Calificado',  color: 'bg-blue-500',    badge: 'blue'   },
		{ id: 'proposal',    label: 'Propuesta',   color: 'bg-amber-500',   badge: 'amber'  },
		{ id: 'negotiation', label: 'Negociación', color: 'bg-orange-500',  badge: 'orange' },
		{ id: 'won',         label: 'Ganado',      color: 'bg-emerald-500', badge: 'green'  },
		{ id: 'lost',        label: 'Perdido',     color: 'bg-red-500',     badge: 'red'    },
	] as const;

	let deals   = $state<Deal[]>([]);
	let loading = $state(true);

	// Sheet
	let sheetOpen   = $state(false);
	let editingDeal = $state<Deal | null>(null);
	let sheetStage  = $state('lead');

	// Delete
	let deleteTarget = $state<Deal | null>(null);
	let deleting     = $state(false);

	// Moving
	let movingId = $state<string | null>(null);

	onMount(async () => {
		try {
			deals = await pb.collection('deals').getFullList<Deal>({
				sort: '-created', expand: 'contact',
				fields: 'id,title,value,currency,stage,probability,expected_close,description,expand',
			});
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al cargar negocios');
		} finally { loading = false; }
	});

	const byStage = $derived(
		Object.fromEntries(stages.map(s => [s.id, deals.filter(d => d.stage === s.id)])) as Record<string, Deal[]>
	);

	const totalByStage = $derived(
		Object.fromEntries(stages.map(s => [
			s.id,
			(byStage[s.id] ?? []).reduce((sum, d) => sum + (d.value ?? 0), 0),
		])) as Record<string, number>
	);

	function openCreate(stageId: string) {
		editingDeal = null; sheetStage = stageId; sheetOpen = true;
	}
	function openEdit(deal: Deal) {
		editingDeal = deal; sheetStage = deal.stage; sheetOpen = true;
	}
	function handleSaved(record: Record<string, unknown>) {
		sheetOpen = false;
		const d = record as unknown as Deal;
		if (editingDeal) {
			deals = deals.map(x => x.id === d.id ? { ...x, ...d } : x);
		} else {
			deals = [d, ...deals];
		}
	}

	async function moveStage(deal: Deal, newStage: string) {
		if (deal.stage === newStage) return;
		movingId = deal.id;
		try {
			await pb.collection('deals').update(deal.id, { stage: newStage });
			deals = deals.map(d => d.id === deal.id ? { ...d, stage: newStage } : d);
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error');
		} finally { movingId = null; }
	}

	async function confirmDelete() {
		if (!deleteTarget) return;
		deleting = true;
		try {
			await pb.collection('deals').delete(deleteTarget.id);
			deals = deals.filter(d => d.id !== deleteTarget?.id);
			toast.success('Negocio eliminado');
			deleteTarget = null;
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al eliminar');
		} finally { deleting = false; }
	}

	const currencySymbol: Record<string, string> = {
		USD: '$', COP: 'COP$', EUR: '€', MXN: 'MX$', BRL: 'R$', ARS: 'AR$',
	};
	function fmt(v: number, c: string) {
		return `${currencySymbol[c] ?? ''}${v?.toLocaleString() ?? 0}`;
	}
	function isOverdue(d: Deal) {
		return d.expected_close && !['won','lost'].includes(d.stage) && new Date(d.expected_close) < new Date();
	}
	function nextStageId(stageId: string): string | null {
		const i = stages.findIndex(s => s.id === stageId);
		return i >= 0 && i < stages.length - 1 ? stages[i + 1].id : null;
	}
</script>

<svelte:head><title>Negocios — Hermes CRM</title></svelte:head>

<div class="flex h-full flex-col">
	<!-- Header -->
	<div class="flex shrink-0 items-center justify-between border-b border-slate-800 px-5 py-4">
		<div>
			<h1>Negocios</h1>
			<p class="mt-0.5 text-sm text-slate-400">{deals.length} negocios en el pipeline</p>
		</div>
		<Btn variant="primary" onclick={() => openCreate('lead')}>
			{#snippet icon()}<Plus class="h-4 w-4" />{/snippet}
			Nuevo negocio
		</Btn>
	</div>

	{#if loading}
		<div class="flex items-center gap-2 p-6 text-sm text-slate-400">
			<div class="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500"></div>
			Cargando pipeline…
		</div>
	{:else}
		<div class="flex-1 overflow-x-auto p-4">
			<div class="flex h-full gap-3" style="min-width: max-content;">
				{#each stages as stage}
					{@const col = byStage[stage.id] ?? []}
					{@const total = totalByStage[stage.id] ?? 0}

					<div class="flex w-64 shrink-0 flex-col rounded-xl border border-slate-800 bg-slate-900/50">
						<!-- Column header -->
						<div class="flex items-center gap-2 border-b border-slate-800 px-3 py-2.5">
							<div class="h-2 w-2 rounded-full {stage.color}"></div>
							<span class="flex-1 text-sm font-medium text-slate-200">{stage.label}</span>
							<span class="text-xs text-slate-500">{col.length}</span>
							<button
								onclick={() => openCreate(stage.id)}
								class="rounded p-0.5 text-slate-500 hover:bg-slate-700 hover:text-slate-300 transition-colors"
								title="Nuevo negocio en {stage.label}"
							>
								<Plus class="h-3.5 w-3.5" />
							</button>
						</div>

						{#if total > 0}
							<div class="border-b border-slate-800/50 px-3 py-1.5">
								<span class="text-xs font-semibold text-emerald-400">
									{col[0]?.currency ? fmt(total, col[0].currency) : total.toLocaleString()}
								</span>
							</div>
						{/if}

						<!-- Cards -->
						<div class="flex-1 space-y-2 overflow-y-auto p-2">
							{#if col.length === 0}
								<button
									onclick={() => openCreate(stage.id)}
									class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-700 py-4 text-xs text-slate-600 hover:border-slate-600 hover:text-slate-400 transition-colors"
								>
									<Plus class="h-3 w-3" /> Añadir
								</button>
							{:else}
								{#each col as deal (deal.id)}
									<div class="group rounded-lg border border-slate-700/60 bg-slate-900 p-3 transition-all hover:border-slate-600 hover:shadow-md
										{movingId === deal.id ? 'opacity-40 pointer-events-none' : ''}">

										<!-- Title + actions -->
										<div class="mb-1.5 flex items-start gap-1">
											<p class="flex-1 text-sm font-medium leading-snug text-slate-100">{deal.title}</p>
											<div class="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
												<button
													onclick={() => openEdit(deal)}
													class="rounded p-1 text-slate-500 hover:bg-slate-700 hover:text-slate-200"
												>
													<Pencil class="h-3 w-3" />
												</button>
												<button
													onclick={() => { deleteTarget = deal; }}
													class="rounded p-1 text-slate-500 hover:bg-red-900/40 hover:text-red-400"
												>
													<Trash2 class="h-3 w-3" />
												</button>
											</div>
										</div>

										<!-- Contact -->
										{#if deal.expand?.contact}
											<a
												href="/contacts/{deal.expand.contact.id}"
												class="mb-2 block truncate text-xs text-blue-400 hover:text-blue-300"
											>
												{deal.expand.contact.name || deal.expand.contact.email}
											</a>
										{/if}

										<!-- Value + close date -->
										<div class="flex items-center justify-between">
											{#if deal.value}
												<span class="text-xs font-semibold text-emerald-400">
													{fmt(deal.value, deal.currency)}
												</span>
											{:else}
												<span></span>
											{/if}
											{#if deal.expected_close}
												<span class="text-xs {isOverdue(deal) ? 'font-medium text-rose-400' : 'text-slate-500'}">
													{deal.expected_close.slice(0, 10)}
												</span>
											{/if}
										</div>

										<!-- Move to next stage -->
										{#if nextStageId(deal.stage) !== null}
											<button
												onclick={() => moveStage(deal, nextStageId(deal.stage)!)}
												class="mt-2 w-full rounded border border-slate-700 py-1 text-xs text-slate-500 transition-colors hover:border-slate-500 hover:text-slate-300"
											>
												→ {stages.find(s => s.id === nextStageId(deal.stage))?.label}
											</button>
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

<!-- Create / Edit Sheet -->
<Sheet
	open={sheetOpen}
	title={editingDeal ? 'Editar negocio' : 'Nuevo negocio'}
	description={editingDeal ? 'Modifica los detalles del negocio' : 'Añade un nuevo negocio al pipeline'}
	onclose={() => { sheetOpen = false; }}
>
	{#snippet children()}
		<DealForm
			deal={editingDeal}
			defaultStage={sheetStage}
			onSave={handleSaved}
			onClose={() => { sheetOpen = false; }}
		/>
	{/snippet}
</Sheet>

<!-- Delete Modal -->
<Modal
	open={!!deleteTarget}
	title="Eliminar negocio"
	message="¿Eliminar '{deleteTarget?.title}'? Esta acción no se puede deshacer."
	confirmLabel="Eliminar"
	variant="danger"
	loading={deleting}
	onconfirm={confirmDelete}
	oncancel={() => { deleteTarget = null; }}
/>
