<script lang="ts">
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { Sheet, Modal, Btn } from '$lib/ui';
	import GoalForm from '$lib/forms/GoalForm.svelte';
	import { Plus, Pencil, Trash2, Target } from 'lucide-svelte';

	// ── Types ─────────────────────────────────────────────────────────────────
	type Goal = {
		id: string; metric: string; target: number;
		currency: string; period: string;
	};
	type GoalWithProgress = Goal & { current: number; pct: number; loading: boolean };

	// ── State ─────────────────────────────────────────────────────────────────
	let goals        = $state<GoalWithProgress[]>([]);
	let loadingGoals = $state(true);
	let sheetOpen    = $state(false);
	let editingGoal  = $state<Goal | null>(null);
	let deleteTarget = $state<Goal | null>(null);
	let deleting     = $state(false);

	// ── Period parsing ────────────────────────────────────────────────────────
	// Supported formats:
	//   2026-Q1  → Jan 1 – Mar 31
	//   2026-Q2  → Apr 1 – Jun 30
	//   2026-Q3  → Jul 1 – Sep 30
	//   2026-Q4  → Oct 1 – Dec 31
	//   2026-05  → May 1 – May 31
	//   2026     → Jan 1 – Dec 31
	//   all-time → no filter
	function parsePeriod(period: string): { start: string; end: string } | null {
		const p = period.trim().toLowerCase();
		if (!p || p === 'all-time') return null;

		const qMatch = /^(\d{4})-q([1-4])$/i.exec(p);
		if (qMatch) {
			const y = qMatch[1];
			const q = Number(qMatch[2]);
			const starts = ['01-01','04-01','07-01','10-01'];
			const ends   = ['03-31','06-30','09-30','12-31'];
			return { start: `${y}-${starts[q-1]}`, end: `${y}-${ends[q-1]}` };
		}
		const mMatch = /^(\d{4})-(\d{2})$/.exec(p);
		if (mMatch) {
			const y  = Number(mMatch[1]);
			const m  = Number(mMatch[2]);
			const end = new Date(y, m, 0); // last day of month
			return {
				start: `${mMatch[1]}-${mMatch[2]}-01`,
				end:   `${mMatch[1]}-${mMatch[2]}-${String(end.getDate()).padStart(2,'0')}`,
			};
		}
		const yMatch = /^(\d{4})$/.exec(p);
		if (yMatch) return { start: `${yMatch[1]}-01-01`, end: `${yMatch[1]}-12-31` };

		return null; // unknown format → no filter
	}

	// ── Calculate progress for one goal ──────────────────────────────────────
	async function calcProgress(goal: Goal): Promise<number> {
		const range = parsePeriod(goal.period);
		const dateFilter = range
			? `created >= '${range.start} 00:00:00' && created <= '${range.end} 23:59:59'`
			: null;

		const addDate = (base: string) => dateFilter ? `${base} && ${dateFilter}` : base;

		try {
			switch (goal.metric) {
				case 'deals_won_count': {
					const r = await pb.collection('deals').getList(1, 1, {
						filter: addDate("stage = 'won'"), fields: 'id',
					});
					return r.totalItems;
				}
				case 'deals_won_value': {
					const rows = await pb.collection('deals').getFullList({
						filter: addDate("stage = 'won'"), fields: 'value',
					});
					return (rows as { value?: number }[]).reduce((s, d) => s + (d.value ?? 0), 0);
				}
				case 'new_contacts': {
					const r = await pb.collection('contacts').getList(1, 1, {
						filter: dateFilter ?? undefined, fields: 'id',
					});
					return r.totalItems;
				}
				case 'new_deals': {
					const r = await pb.collection('deals').getList(1, 1, {
						filter: dateFilter ?? undefined, fields: 'id',
					});
					return r.totalItems;
				}
				case 'activities_done': {
					const r = await pb.collection('activities').getList(1, 1, {
						filter: dateFilter ?? undefined, fields: 'id',
					});
					return r.totalItems;
				}
				default: return 0;
			}
		} catch { return 0; }
	}

	// ── Load all goals + calculate progress in parallel ──────────────────────
	async function loadGoals() {
		loadingGoals = true;
		try {
			const raw = await pb.collection('goals').getFullList<Goal>({ sort: 'created' });
			// Seed with loading=true, pct=0 to render immediately, then fill
			goals = raw.map(g => ({ ...g, current: 0, pct: 0, loading: true }));

			// Calculate progress concurrently (one request per goal)
			await Promise.all(
				goals.map(async (g, idx) => {
					const current = await calcProgress(g);
					const pct     = Math.min(Math.round((current / Math.max(g.target, 1)) * 100), 100);
					// Reactive update: replace the specific entry
					goals = goals.map((x, i) => i === idx ? { ...x, current, pct, loading: false } : x);
				})
			);
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al cargar metas');
		} finally { loadingGoals = false; }
	}

	onMount(loadGoals);

	function handleSaved() { sheetOpen = false; loadGoals(); }

	async function confirmDelete() {
		if (!deleteTarget) return;
		deleting = true;
		try {
			await pb.collection('goals').delete(deleteTarget.id);
			toast.success('Meta eliminada');
			deleteTarget = null;
			loadGoals();
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al eliminar');
		} finally { deleting = false; }
	}

	// ── Metric metadata ───────────────────────────────────────────────────────
	const metricLabel: Record<string, string> = {
		deals_won_count: 'NEGOCIOS_GANADOS // QTY',
		deals_won_value: 'INGRESOS_GANADOS // VALUE',
		new_contacts:    'NUEVOS_CONTACTOS',
		new_deals:       'NUEVOS_NEGOCIOS',
		activities_done: 'ACTIVIDADES_DONE',
	};
	const currencySymbol: Record<string, string> = {
		USD: '$', COP: 'COP$', EUR: '€', MXN: 'MX$', BRL: 'R$', ARS: 'AR$',
	};

	function formatValue(goal: GoalWithProgress, val: number): string {
		if (goal.metric === 'deals_won_value') {
			return `${currencySymbol[goal.currency] ?? ''}${val.toLocaleString('es', { maximumFractionDigits: 0 })}`;
		}
		return String(val);
	}
</script>

<svelte:head><title>Metas — Hermes CRM</title></svelte:head>

<div class="p-6 lg:p-8 uppercase tracking-widest" style="font-size:11px;">

	<!-- ══════════════════════════════════════════════════════════════════════ -->
	<!-- HEADER                                                                 -->
	<!-- ══════════════════════════════════════════════════════════════════════ -->
	<div class="mb-8 flex items-end justify-between">
		<div>
			<div class="text-[10px] tracking-widest text-[#555]">GOALS // PERFORMANCE</div>
			<div class="mt-1 font-sans text-xl font-bold text-white" style="letter-spacing:-0.02em; text-transform:none;">
				Metas de ventas
			</div>
			<div class="mt-0.5 text-[9px] text-[#555]">
				{goals.length} META{goals.length !== 1 ? 'S' : ''} — actualizadas en tiempo real
			</div>
		</div>
		<button
			onclick={() => { editingGoal = null; sheetOpen = true; }}
			class="flex items-center gap-2 bg-white px-5 py-2.5 text-[11px] font-bold tracking-widest text-black
				hover:bg-[#ddd] transition-colors normal-case"
		>
			<Plus class="h-3.5 w-3.5" />
			NUEVA META
		</button>
	</div>

	<!-- ══════════════════════════════════════════════════════════════════════ -->
	<!-- GOALS GRID                                                             -->
	<!-- ══════════════════════════════════════════════════════════════════════ -->
	{#if loadingGoals}
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
			{#each Array(4) as _}
				<div class="h-32 animate-pulse border border-[#1a1a1a] bg-[#090909]"></div>
			{/each}
		</div>
	{:else if goals.length === 0}
		<div class="border border-[#1a1a1a] bg-[#090909] py-20 text-center">
			<Target class="mx-auto mb-4 h-8 w-8 text-[#333]" />
			<p class="text-[#444]">SIN_METAS — DEFINE TUS OBJETIVOS DE VENTAS</p>
			<button
				onclick={() => { editingGoal = null; sheetOpen = true; }}
				class="mt-4 border border-[#333] px-4 py-2 text-[10px] text-[#666] hover:text-white hover:border-[#555] transition-colors"
			>
				+ CREAR PRIMERA META
			</button>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
			{#each goals as goal, i (goal.id)}
				<div class="group relative border border-[#1a1a1a] bg-[#090909] p-5">
					<!-- Section number -->
					<div class="absolute -left-2.5 -top-2.5 flex h-4 w-4 items-center justify-center
						bg-white text-[9px] font-bold text-black">{i + 1}</div>

					<!-- Header row -->
					<div class="mb-4 flex items-start justify-between">
						<div>
							<div class="text-[10px] tracking-widest text-[#888]">
								{metricLabel[goal.metric] ?? goal.metric.toUpperCase()}
							</div>
							<div class="mt-1 text-[9px] text-[#444]">
								PERÍODO: {goal.period.toUpperCase()}
							</div>
						</div>
						<!-- Actions (visible on hover) -->
						<div class="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
							<button
								onclick={() => { editingGoal = goal; sheetOpen = true; }}
								class="border border-[#222] p-1.5 text-[#555] hover:text-white hover:border-[#444] transition-colors"
							>
								<Pencil class="h-3 w-3" />
							</button>
							<button
								onclick={() => { deleteTarget = goal; }}
								class="border border-[#222] p-1.5 text-[#555] hover:text-rose-400 hover:border-rose-900 transition-colors"
							>
								<Trash2 class="h-3 w-3" />
							</button>
						</div>
					</div>

					<!-- Progress bar -->
					<div class="mb-3 h-2 w-full overflow-hidden border border-[#1a1a1a] bg-[#111]">
						{#if goal.loading}
							<!-- Skeleton shimmer -->
							<div class="h-full animate-pulse bg-[#222]"></div>
						{:else}
							<div
								class="h-full transition-all duration-700"
								style="
									width: {goal.pct}%;
									background: {goal.pct >= 100
										? 'linear-gradient(to right, #ff3333, #ffaa00, #00ffaa, #00aaff, #aa00ff)'
										: goal.pct >= 75
											? 'linear-gradient(to right, #00ffaa, #00aaff)'
											: goal.pct >= 40
												? '#3b82f6'
												: '#1d4ed8'
									};
								"
							></div>
						{/if}
					</div>

					<!-- Numbers row -->
					<div class="flex items-baseline justify-between">
						<div class="flex items-baseline gap-2">
							{#if goal.loading}
								<div class="h-6 w-16 animate-pulse bg-[#1a1a1a]"></div>
							{:else}
								<span class="font-sans font-bold text-white" style="font-size:22px; letter-spacing:-0.02em;">
									{formatValue(goal, goal.current)}
								</span>
								<span class="text-[9px] text-[#444]">
									/ {formatValue(goal, goal.target)}
								</span>
							{/if}
						</div>

						<!-- Percentage badge -->
						{#if !goal.loading}
							<div class="border border-[#222] px-2 py-0.5 text-[10px] font-bold
								{goal.pct >= 100
									? 'border-emerald-900 text-transparent'
									: goal.pct >= 75
										? 'text-white'
										: 'text-[#666]'
								}"
								style={goal.pct >= 100
									? 'background: linear-gradient(to right, #ff3333, #ffaa00, #00ffaa); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;'
									: ''}
							>
								{goal.pct}%
							</div>
						{/if}
					</div>

					<!-- Completed indicator -->
					{#if goal.pct >= 100 && !goal.loading}
						<div class="mt-2 text-[9px] tracking-widest" style="
							background: linear-gradient(to right, #ff3333, #ffaa00, #00ffaa);
							-webkit-background-clip:text; -webkit-text-fill-color:transparent;
							background-clip:text;">
							✓ META ALCANZADA
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Create / Edit Sheet -->
<Sheet
	open={sheetOpen}
	title={editingGoal ? 'Editar meta' : 'Nueva meta'}
	description={editingGoal ? 'Modifica el objetivo y período' : 'Define un objetivo de ventas con un período específico'}
	onclose={() => { sheetOpen = false; }}
>
	{#snippet children()}
		<GoalForm
			goal={editingGoal}
			onSave={handleSaved}
			onClose={() => { sheetOpen = false; }}
		/>
	{/snippet}
</Sheet>

<!-- Delete Modal -->
<Modal
	open={!!deleteTarget}
	title="Eliminar meta"
	message="¿Eliminar esta meta? El progreso registrado no se borra, solo la definición del objetivo."
	confirmLabel="Eliminar"
	variant="danger"
	loading={deleting}
	onconfirm={confirmDelete}
	oncancel={() => { deleteTarget = null; }}
/>
