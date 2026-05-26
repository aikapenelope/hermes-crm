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
		{ id: 'lead',        label: 'LEAD',        dot: 'bg-[#555]'   },
		{ id: 'qualified',   label: 'CALIFICADO',  dot: 'bg-blue-500' },
		{ id: 'proposal',    label: 'PROPUESTA',   dot: 'bg-amber-500'},
		{ id: 'negotiation', label: 'NEGOCIACIÓN', dot: 'bg-orange-500'},
		{ id: 'won',         label: 'GANADO',      dot: 'bg-emerald-500'},
		{ id: 'lost',        label: 'PERDIDO',     dot: 'bg-rose-600' },
	] as const;

	let deals        = $state<Deal[]>([]);
	let loading      = $state(true);
	let sheetOpen    = $state(false);
	let editingDeal  = $state<Deal | null>(null);
	let sheetStage   = $state('lead');
	let deleteTarget = $state<Deal | null>(null);
	let deleting     = $state(false);
	let savingId     = $state<string | null>(null); // API in-progress

	// ── Drag-and-drop state ───────────────────────────────────────────────────
	let draggingDeal  = $state<Deal | null>(null);
	let dragOverStage = $state<string | null>(null);

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

	function openCreate(stageId: string) { editingDeal = null; sheetStage = stageId; sheetOpen = true; }
	function openEdit(deal: Deal) { editingDeal = deal; sheetStage = deal.stage; sheetOpen = true; }
	function handleSaved(record: Record<string, unknown>) {
		sheetOpen = false;
		const d = record as unknown as Deal;
		if (editingDeal) deals = deals.map(x => x.id === d.id ? { ...x, ...d } : x);
		else              deals = [d, ...deals];
	}

	async function moveStage(deal: Deal, newStage: string) {
		if (deal.stage === newStage || savingId) return;
		savingId = deal.id;
		// Optimistic update — immediately reflect in UI
		deals = deals.map(d => d.id === deal.id ? { ...d, stage: newStage } : d);
		try {
			await pb.collection('deals').update(deal.id, { stage: newStage });
		} catch (e: unknown) {
			// Rollback on error
			deals = deals.map(d => d.id === deal.id ? { ...d, stage: deal.stage } : d);
			toast.error(e instanceof Error ? e.message : 'Error al mover negocio');
		} finally { savingId = null; }
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

	// ── HTML5 Drag-and-Drop handlers ──────────────────────────────────────────
	function onDragStart(e: DragEvent, deal: Deal) {
		draggingDeal = deal;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', deal.id);
		}
	}
	function onDragEnd() {
		draggingDeal  = null;
		dragOverStage = null;
	}
	function onDragOver(e: DragEvent, stageId: string) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		dragOverStage = stageId;
	}
	function onDragLeave(e: DragEvent) {
		// Only clear if leaving the column, not entering a child element
		const target = e.currentTarget as HTMLElement;
		const related = e.relatedTarget as Node | null;
		if (!related || !target.contains(related)) {
			dragOverStage = null;
		}
	}
	function onDrop(e: DragEvent, stageId: string) {
		e.preventDefault();
		dragOverStage = null;
		if (draggingDeal && draggingDeal.stage !== stageId) {
			moveStage(draggingDeal, stageId);
		}
		draggingDeal = null;
	}

	const currencySymbol: Record<string, string> = {
		USD: '$', COP: 'COP$', EUR: '€', MXN: 'MX$', BRL: 'R$', ARS: 'AR$',
	};
	function fmt(v: number, c: string) {
		return `${currencySymbol[c] ?? ''}${v?.toLocaleString('es', { maximumFractionDigits: 0 }) ?? 0}`;
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

<div class="flex h-full flex-col" style="font-size:11px;">

	<!-- Header -->
	<div class="flex shrink-0 items-center justify-between border-b border-[#1a1a1a] px-6 py-4
		uppercase tracking-widest">
		<div>
			<div class="text-[10px] text-[#555]">PIPELINE // DEALS</div>
			<div class="mt-0.5 font-sans text-lg font-bold text-white" style="letter-spacing:-0.02em; text-transform:none;">
				{deals.length} negocios
			</div>
		</div>
		<button
			onclick={() => openCreate('lead')}
			class="flex items-center gap-2 bg-white px-5 py-2.5 text-[11px] font-bold tracking-widest text-black
				hover:bg-[#ddd] transition-colors"
		>
			<Plus class="h-3.5 w-3.5" />
			NUEVO NEGOCIO
		</button>
	</div>

	{#if loading}
		<div class="flex items-center gap-2 p-6 text-[#555] uppercase tracking-widest text-[10px]">
			<div class="h-3 w-3 animate-spin rounded-full border border-[#333] border-t-white"></div>
			CARGANDO PIPELINE…
		</div>
	{:else}
		<!-- Kanban board -->
		<div class="flex-1 overflow-x-auto p-4">
			<div class="flex h-full gap-3" style="min-width: max-content;">
				{#each stages as stage}
					{@const col   = byStage[stage.id] ?? []}
					{@const total = totalByStage[stage.id] ?? 0}
					{@const isDragTarget = dragOverStage === stage.id}

					<!-- Drop zone column -->
					<div
						class="flex w-60 shrink-0 flex-col border border-[#1a1a1a] bg-[#090909]
							transition-all duration-150"
						style={isDragTarget
							? 'border-color: transparent; box-shadow: 0 0 0 1px transparent; outline: 1px solid; outline-color: #ff3333; background-image: linear-gradient(#090909, #090909), linear-gradient(to bottom, #ff3333, #ffaa00, #00ffaa, #00aaff, #aa00ff); background-origin: border-box; background-clip: padding-box, border-box; border-radius:0;'
							: ''}
						ondragover={(e) => onDragOver(e, stage.id)}
						ondragleave={onDragLeave}
						ondrop={(e) => onDrop(e, stage.id)}
						role="list"
						aria-label="Columna {stage.label}"
					>
						<!-- Column header -->
						<div class="flex items-center gap-2 border-b border-[#1a1a1a] px-3 py-2.5 uppercase tracking-widest">
							<div class="h-1.5 w-1.5 rounded-full {stage.dot}"></div>
							<span class="flex-1 text-[10px] text-[#888]">{stage.label}</span>
							<span class="text-[9px] text-[#444]">{col.length}</span>
							<button
								onclick={() => openCreate(stage.id)}
								class="text-[#444] hover:text-white transition-colors"
								title="Nuevo negocio en {stage.label}"
							>
								<Plus class="h-3 w-3" />
							</button>
						</div>

						<!-- Stage total -->
						{#if total > 0}
							<div class="border-b border-[#111] px-3 py-1.5 uppercase tracking-widest">
								<span class="text-[9px] font-bold text-emerald-500">
									{col[0]?.currency ? fmt(total, col[0].currency) : total.toLocaleString()}
								</span>
							</div>
						{/if}

						<!-- Cards -->
						<div class="flex-1 space-y-1.5 overflow-y-auto p-2">
							{#if col.length === 0}
								<!-- Empty column drop hint -->
								<div class="flex h-16 items-center justify-center border border-dashed border-[#1a1a1a]
									text-[9px] uppercase tracking-widest text-[#333] transition-colors
									{isDragTarget ? 'border-[#555] text-[#555]' : ''}">
									{isDragTarget ? 'SOLTAR AQUÍ' : 'VACÍO'}
								</div>
							{:else}
								{#each col as deal (deal.id)}
									<!-- Draggable card -->
									<div
										draggable="true"
										ondragstart={(e) => onDragStart(e, deal)}
										ondragend={onDragEnd}
										class="group cursor-grab border border-[#1a1a1a] bg-[#0d0d0d] p-3
											transition-all duration-150 active:cursor-grabbing
											{draggingDeal?.id === deal.id ? 'opacity-30 scale-95' : ''}
											{savingId === deal.id ? 'opacity-50 pointer-events-none' : ''}
											hover:border-[#333] hover:bg-[#111]"
										role="listitem"
									>
										<!-- Title row -->
										<div class="mb-2 flex items-start justify-between gap-1">
											<p class="flex-1 normal-case font-medium leading-snug text-[12px] text-white"
												style="letter-spacing:0;">
												{deal.title}
											</p>
											<!-- Actions (hover only, not shown while dragging) -->
											<div class="flex shrink-0 gap-0.5 opacity-0 transition-opacity
												group-hover:opacity-100
												{draggingDeal ? 'opacity-0 pointer-events-none' : ''}">
												<button
													onclick={() => openEdit(deal)}
													class="border border-[#1a1a1a] p-1 text-[#444] hover:text-white hover:border-[#333] transition-colors"
												>
													<Pencil class="h-2.5 w-2.5" />
												</button>
												<button
													onclick={() => { deleteTarget = deal; }}
													class="border border-[#1a1a1a] p-1 text-[#444] hover:text-rose-500 hover:border-rose-900 transition-colors"
												>
													<Trash2 class="h-2.5 w-2.5" />
												</button>
											</div>
										</div>

										<!-- Contact -->
										{#if deal.expand?.contact}
											<a
												href="/contacts/{deal.expand.contact.id}"
												onclick={(e) => e.stopPropagation()}
												class="mb-2 block truncate uppercase text-[8px] tracking-widest text-[#555] hover:text-white transition-colors"
											>
												{deal.expand.contact.name || deal.expand.contact.email}
											</a>
										{/if}

										<!-- Value + date -->
										<div class="flex items-center justify-between uppercase tracking-widest">
											{#if deal.value}
												<span class="text-[9px] font-bold text-emerald-500">
													{fmt(deal.value, deal.currency)}
												</span>
											{:else}
												<span></span>
											{/if}
											{#if deal.expected_close}
												<span class="text-[8px] {isOverdue(deal) ? 'text-rose-500' : 'text-[#444]'}">
													{deal.expected_close.slice(0, 10)}
												</span>
											{/if}
										</div>

										<!-- Quick move button (next stage only) -->
										{#if nextStageId(deal.stage) && !draggingDeal}
											<button
												onclick={() => moveStage(deal, nextStageId(deal.stage)!)}
												class="mt-2 w-full border border-[#1a1a1a] py-1 text-[8px] uppercase tracking-widest
													text-[#444] transition-colors hover:border-[#333] hover:text-[#888]"
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

	<!-- DnD instructions -->
	{#if !loading && deals.length > 0}
		<div class="shrink-0 border-t border-[#1a1a1a] px-6 py-2 text-[8px] uppercase tracking-widest text-[#333]">
			DRAG & DROP — arrastra las tarjetas entre columnas para cambiar etapa
		</div>
	{/if}
</div>

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
