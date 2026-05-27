<script lang="ts">
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { currentUser } from '$lib/stores';

	// ── Types ─────────────────────────────────────────────────────────────────
	type UpcomingTask = {
		id: string; title: string; type: string;
		priority: string; status: string; due_date: string;
		expand?: { contact?: { name: string; email: string } };
	};
	/**
	 * Recent notes across all contacts — used in Section 3 instead of
	 * raw conversation logs.  Notes are structured context added by the
	 * human team, directly actionable from the CRM.
	 */
	type RecentNote = {
		id: string; content: string; created: string;
		expand?: { contact?: { id: string; name: string } };
	};
	type PriorityTask = {
		id: string; title: string; type: string; priority: string; status: string;
	};

	// ── State ─────────────────────────────────────────────────────────────────
	let loading = $state(true);

	// Stats
	let contactsTotal     = $state(0);
	let statusBarsRaw     = $state([0, 0, 0, 0, 0]); // lead/prospect/customer/churned/inactive
	let openDealsCount    = $state(0);
	let openDealsValue    = $state(0);
	let wonDealsCount     = $state(0);
	let wonDealsValue     = $state(0);
	let totalDealsCount   = $state(0);
	let dealLeadCount     = $state(0);
	let dealProposalCount = $state(0);
	let dealNegCount      = $state(0);
	let overdueTasksCount = $state(0);
	let tasksBarsRaw      = $state([0, 0, 0, 0]); // urgent/high/medium/low

	// Sections
	let upcomingTasks = $state<UpcomingTask[]>([]);
	let recentNotes   = $state<RecentNote[]>([]);
	let priorityTasks = $state<PriorityTask[]>([]);

	// ── Greeting ──────────────────────────────────────────────────────────────
	const greeting = (() => {
		const h = new Date().getHours();
		return h < 12 ? 'BUENOS DÍAS' : h < 18 ? 'BUENAS TARDES' : 'BUENAS NOCHES';
	})();

	const agentName = $derived(
		String($currentUser?.get?.('name') ?? $currentUser?.email ?? 'AGENTE')
			.split('@')[0].split(' ')[0].toUpperCase()
	);

	// ── Load ──────────────────────────────────────────────────────────────────
	onMount(async () => {
		const today = new Date().toISOString().slice(0, 10);
		try {
			// Use getList(1,1) to get totalItems without downloading all records.
			// Only fetch actual data for the sections that need it (upcoming tasks,
			// recent notes, priority tasks). Stats are computed from totals only.
			const [
				contactsRes, dealsOpenRes, dealsWonRes,
				tasksOverdueRes,
				tasksByPriority,
				upcoming, notes, priority,
			] = await Promise.all([
				// Totals only — no data download, just the count
				pb.collection('contacts').getList(1, 1, { fields: 'id' }),
				pb.collection('deals').getList(1, 200, {
					filter: "stage != 'won' && stage != 'lost'",
					fields: 'stage,value',
				}),
				pb.collection('deals').getList(1, 200, {
					filter: "stage = 'won'",
					fields: 'value',
				}),
				// Overdue tasks count — just the total
				pb.collection('tasks').getList(1, 1, {
					filter: `(status = 'todo' || status = 'in_progress') && due_date != '' && due_date < '${today}'`,
					fields: 'id',
				}),
				// Priority distribution — only pending tasks
				pb.collection('tasks').getList(1, 200, {
					filter: "status != 'done' && status != 'cancelled'",
					fields: 'priority',
				}),
				// Upcoming tasks — only 4 records with expand
				pb.collection('tasks').getList<UpcomingTask>(1, 4, {
					filter: "(status = 'todo' || status = 'in_progress')",
					sort: 'due_date,-created',
					expand: 'contact',
					fields: 'id,title,type,priority,status,due_date,expand',
				}),
				// Recent notes — only 3
				pb.collection('notes').getList<RecentNote>(1, 3, {
					sort: '-created',
					expand: 'contact',
					fields: 'id,content,created,expand',
				}),
				// Priority tasks — only 3
				pb.collection('tasks').getList<PriorityTask>(1, 3, {
					filter: "(priority = 'urgent' || priority = 'high') && (status = 'todo' || status = 'in_progress')",
					sort: '-priority,due_date',
					fields: 'id,title,type,priority,status',
				}),
			]);

			// Contacts total (no status breakdown without full list — use totalItems)
			contactsTotal = contactsRes.totalItems;
			// Status bars: not available without getFullList, use uniform bars
			statusBarsRaw = [1, 1, 1, 1, 1]; // placeholder proportional bars

			// Deals stats from paginated results
			const openD = dealsOpenRes.items as unknown as { stage: string; value?: number }[];
			const wonD  = dealsWonRes.items as unknown as { value?: number }[];
			openDealsCount    = dealsOpenRes.totalItems;
			openDealsValue    = openD.reduce((s, d) => s + (d.value ?? 0), 0);
			wonDealsCount     = dealsWonRes.totalItems;
			wonDealsValue     = wonD.reduce((s, d) => s + (d.value ?? 0), 0);
			totalDealsCount   = dealsOpenRes.totalItems + dealsWonRes.totalItems;
			dealLeadCount     = openD.filter(d => d.stage === 'lead').length;
			dealProposalCount = openD.filter(d => d.stage === 'proposal').length;
			dealNegCount      = openD.filter(d => d.stage === 'negotiation').length;

			// Tasks stats
			overdueTasksCount = tasksOverdueRes.totalItems;
			const pts = tasksByPriority.items as unknown as { priority: string }[];
			tasksBarsRaw = [
				pts.filter(t => t.priority === 'urgent').length,
				pts.filter(t => t.priority === 'high').length,
				pts.filter(t => t.priority === 'medium').length,
				pts.filter(t => t.priority === 'low').length,
			];

			upcomingTasks = upcoming.items;
			recentNotes   = notes.items;
			priorityTasks = priority.items;
		} catch (e) {
			// eslint-disable-next-line no-console
			if (import.meta.env.DEV) console.error(e);
		} finally {
			loading = false;
		}
	});

	// ── Derived chart values ───────────────────────────────────────────────────
	const wonPct    = $derived(Math.round((wonDealsCount / Math.max(totalDealsCount, 1)) * 100));
	const donutFill = $derived(wonPct * 100.53 / 100);

	// ── Helpers ────────────────────────────────────────────────────────────────
	function fmtDate(d: string): string {
		if (!d) return 'SIN_FECHA';
		const dt = new Date(d);
		const p  = (n: number) => String(n).padStart(2, '0');
		return `${p(dt.getDate())}.${p(dt.getMonth() + 1)}.${dt.getFullYear()}`;
	}
	function timeAgo(d: string): string {
		const diff = Date.now() - new Date(d).getTime();
		const m = Math.floor(diff / 60000);
		if (m < 60)  return `${m} MIN AGO`;
		const h = Math.floor(m / 60);
		if (h < 24)  return `${h} HRS AGO`;
		return `${Math.floor(h / 24)} DAYS AGO`;
	}
	function truncate(s: string, n = 120): string {
		return s.length > n ? s.slice(0, n) + '…' : s;
	}
	function typeLabel(t: string): string {
		const m: Record<string, string> = {
			call: 'LLAMADA', email: 'EMAIL', meeting: 'REUNIÓN',
			demo: 'DEMO', task: 'TAREA', follow_up: 'SEGUIMIENTO',
		};
		return m[t] ?? t.toUpperCase();
	}
	function barStyle(val: number, max: number, isRainbow: boolean): string {
		const h = Math.max(Math.round((val / Math.max(max, 1)) * 100), 4);
		const bg = isRainbow
			? 'linear-gradient(to top, #ff3333, #ffaa00, #00ffaa, #00aaff, #aa00ff)'
			: h > 50 ? '#333' : '#222';
		return `height:${h}%; background:${bg};`;
	}

	// Left-border accent colors for note entries (most recent → oldest → neutral)
	const noteBorderColors = [
		'background: white;',
		'background: linear-gradient(to bottom, #3b82f6, #8b5cf6);',
		'background: #333;',
	];
</script>

<svelte:head><title>Dashboard — Hermes CRM</title></svelte:head>

<div class="p-8 lg:p-12 pb-16 uppercase tracking-widest" style="font-size:11px;">

	<!-- ════════════════════════════════════════════════════════════════════════ -->
	<!-- HEADER                                                                   -->
	<!-- ════════════════════════════════════════════════════════════════════════ -->
	<div class="mb-10 flex items-end justify-between">
		<div>
			<h1 class="mb-2 normal-case tracking-tight text-[#aaa]"
				style="font-size:28px; font-family:system-ui,sans-serif; font-weight:700; letter-spacing:-0.01em;">
				{greeting},&nbsp;<span class="text-white">{agentName}.</span>
			</h1>
			<div class="text-[10px] tracking-widest text-[#555]">
				CONECTADO // {new Date().toLocaleDateString('es', { weekday:'long', day:'2-digit', month:'long' }).toUpperCase()}
			</div>
		</div>
		<a
			href="/contacts"
			class="bg-white px-6 py-3 text-[11px] font-bold tracking-widest text-black
				transition-colors hover:bg-[#ddd]"
		>
			NUEVO CONTACTO
		</a>
	</div>

	<!-- ════════════════════════════════════════════════════════════════════════ -->
	<!-- SECTION 1 — STAT CARDS                                                  -->
	<!-- ════════════════════════════════════════════════════════════════════════ -->
	<div class="relative mb-10">
		<div class="absolute -left-3 -top-3 z-10 flex h-4 w-4 items-center justify-center
			bg-white text-[10px] font-bold text-black">1</div>

		<div class="grid grid-cols-2 gap-6 lg:grid-cols-4">

			<!-- Card 1: CONTACTOS // ESTADO_SPLIT -->
			<div class="flex h-36 flex-col justify-between border border-[#1a1a1a] bg-[#090909] p-5">
				<div class="text-[10px] tracking-widest text-[#555]">CONT // ESTADO_SPLIT</div>

				{#if loading}
					<div class="mt-4 h-10 bg-[#111]"></div>
				{:else}
					{@const maxBar = Math.max(...statusBarsRaw, 1)}
					<div class="mt-4 flex h-10 items-end gap-1">
						{#each statusBarsRaw as val}
							<div class="w-1/5" style={barStyle(val, maxBar, val === maxBar && val > 0)}></div>
						{/each}
					</div>
				{/if}

				<div class="mt-4 flex items-baseline gap-2">
					<span class="font-sans text-2xl font-medium text-white" style="letter-spacing:-0.02em;">
						{loading ? '—' : contactsTotal}
					</span>
					<span class="text-[10px] tracking-widest text-[#555]">CONTACTOS</span>
				</div>
			</div>

			<!-- Card 2: DEALS // PIPELINE -->
			<div class="flex h-36 flex-col justify-between border border-[#1a1a1a] bg-[#090909] p-5">
				<div class="text-[10px] tracking-widest text-[#555]">DEALS // PIPELINE</div>

				<div class="mt-4 flex h-10 w-full items-center">
					<svg width="100%" height="40" viewBox="0 0 200 40" preserveAspectRatio="none">
						<defs>
							<linearGradient id="rg-line" x1="0%" y1="0%" x2="100%" y2="0%">
								<stop offset="0%"   stop-color="#ff3333"/>
								<stop offset="25%"  stop-color="#ffaa00"/>
								<stop offset="50%"  stop-color="#00ffaa"/>
								<stop offset="75%"  stop-color="#00aaff"/>
								<stop offset="100%" stop-color="#aa00ff"/>
							</linearGradient>
						</defs>
						<path d="M0,35 Q30,35 50,20 T100,10 T140,30 T180,5 T200,20"
							fill="none" stroke="url(#rg-line)" stroke-width="3" stroke-linecap="round"/>
					</svg>
				</div>

				<div class="mt-4 flex items-baseline gap-2">
					<span class="font-sans text-2xl font-medium text-white" style="letter-spacing:-0.02em;">
						{loading ? '—' : openDealsCount}
					</span>
					<span class="text-[10px] tracking-widest text-[#555]">ABIERTOS</span>
				</div>
			</div>

			<!-- Card 3: DEALS // CERRADOS (donut) -->
			<div class="relative flex h-36 flex-col justify-between border border-[#1a1a1a] bg-[#090909] p-5">
				<div class="flex items-start justify-between">
					<div class="text-[10px] tracking-widest text-[#555]">DEALS // CERRADOS</div>
					<div class="absolute right-5 top-5 text-[9px] text-[#444]">META: 10/MO</div>
				</div>

				{#if !loading}
					<div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[50%] h-14 w-14">
						<svg width="100%" height="100%" viewBox="0 0 40 40">
							<defs>
								<linearGradient id="rg-donut" x1="0%" y1="0%" x2="100%" y2="0%">
									<stop offset="0%"   stop-color="#ff3333"/>
									<stop offset="25%"  stop-color="#ffaa00"/>
									<stop offset="50%"  stop-color="#00ffaa"/>
									<stop offset="75%"  stop-color="#00aaff"/>
									<stop offset="100%" stop-color="#aa00ff"/>
								</linearGradient>
							</defs>
							<circle cx="20" cy="20" r="16" fill="none" stroke="#222" stroke-width="3"/>
							<circle cx="20" cy="20" r="16" fill="none" stroke="url(#rg-donut)"
								stroke-width="3"
								stroke-dasharray="{donutFill} 100.53"
								stroke-linecap="round"
								transform="rotate(-90 20 20)"/>
						</svg>
						<div class="absolute inset-0 flex items-center justify-center
							text-[10px] font-bold text-white">{wonPct}%</div>
					</div>
				{/if}

				<div class="mt-14 flex items-baseline gap-2">
					<span class="font-sans text-2xl font-medium text-white" style="letter-spacing:-0.02em;">
						{loading ? '—' : String(wonDealsCount).padStart(2, '0')}
					</span>
					<span class="text-[10px] tracking-widest text-[#555]">GANADOS</span>
				</div>
			</div>

			<!-- Card 4: TAREAS // PENDIENTES -->
			<div class="flex h-36 flex-col justify-between border border-[#1a1a1a] bg-[#090909] p-5">
				<div class="text-[10px] tracking-widest text-[#555]">TAREAS // PENDIENTES</div>

				{#if loading}
					<div class="mt-4 h-10 bg-[#111]"></div>
				{:else}
					{@const maxTask = Math.max(...tasksBarsRaw, 1)}
					<div class="mt-4 flex h-10 items-end justify-between gap-1">
						{#each tasksBarsRaw as val}
							{@const h = Math.max(Math.round((val / maxTask) * 100), 4)}
							<div class="flex-1" style="height:{h}%; background:{h === 100 ? 'white' : h > 50 ? '#333' : '#222'};"></div>
						{/each}
					</div>
				{/if}

				<div class="mt-4 flex items-baseline gap-2">
					<span class="font-sans text-2xl font-medium text-white" style="letter-spacing:-0.02em;">
						{loading ? '—' : overdueTasksCount}
					</span>
					<span class="text-[10px] tracking-widest text-[#555]">VENCIDAS</span>
				</div>
			</div>

		</div>
	</div>

	<!-- ════════════════════════════════════════════════════════════════════════ -->
	<!-- MAIN GRID 8 + 4                                                          -->
	<!-- ════════════════════════════════════════════════════════════════════════ -->
	<div class="grid grid-cols-1 gap-10 lg:grid-cols-12">

		<!-- ════════════════════════════════════ LEFT COL (span 8) ══════════ -->
		<div class="flex flex-col gap-10 lg:col-span-8">

			<!-- ── Section 2: Upcoming tasks ────────────────────────────────── -->
			<div class="relative border border-[#1a1a1a] bg-[#090909] p-6 pt-8">
				<div class="absolute -left-3 -top-3 z-10 flex h-4 w-4 items-center justify-center
					bg-white text-[10px] font-bold text-black">2</div>

				<div class="mb-6 flex items-center justify-between">
					<div class="tracking-widest text-[#888]">PRÓXIMAS_TAREAS</div>
					<a href="/tasks"
						class="border-b border-[#333] pb-0.5 text-[9px] tracking-widest text-[#444] hover:text-white transition-colors">
						VER_TODAS →
					</a>
				</div>

				{#if loading}
					{#each Array(4) as _}
						<div class="mb-3 h-14 border border-[#1a1a1a] bg-[#111]"></div>
					{/each}
				{:else if upcomingTasks.length === 0}
					<div class="py-8 text-center text-[#444]">SIN_TAREAS_PENDIENTES</div>
				{:else}
					<div class="flex flex-col gap-3">
						{#each upcomingTasks as task (task.id)}
							<a href="/tasks"
								class="flex items-center justify-between border border-[#1a1a1a] p-4
									transition-colors hover:border-[#333] group">
								<div class="flex items-center gap-6 lg:gap-8 min-w-0">
									<div class="w-28 shrink-0 tracking-widest text-[#666]">
										{task.due_date ? fmtDate(task.due_date) : 'SIN_FECHA'}
									</div>
									<div class="min-w-0">
										<div class="mb-0.5 truncate font-sans text-[13px] font-semibold capitalize text-white"
											style="letter-spacing:-0.01em;">
											{task.expand?.contact?.name ?? task.title}
										</div>
										<div class="text-[9px] tracking-widest text-[#555]">
											{typeLabel(task.type)} // {task.title.toUpperCase().slice(0, 40)}
										</div>
									</div>
								</div>
								{#if task.priority === 'urgent'}
									<div class="ml-4 shrink-0 border border-[#333] px-2 py-1 text-[8px] tracking-widest text-rose-400">
										URGENTE
									</div>
								{/if}
							</a>
						{/each}
					</div>
				{/if}
			</div>

			<!-- ── Section 3: Recent notes ───────────────────────────────────── -->
			<div class="relative min-h-64 border border-[#1a1a1a] bg-[#090909] p-6 pt-8">
				<div class="absolute -left-3 -top-3 z-10 flex h-4 w-4 items-center justify-center
					bg-white text-[10px] font-bold text-black">3</div>

				<div class="mb-8 flex items-center justify-between">
					<div class="tracking-widest text-[#888]">NOTAS_RECIENTES // CRM</div>
					<a href="/contacts"
						class="border-b border-[#333] pb-0.5 text-[9px] tracking-widest text-[#444] hover:text-white transition-colors">
						VER_CONTACTOS →
					</a>
				</div>

				{#if loading}
					<div class="space-y-8 ml-2">
						{#each Array(3) as _}
							<div class="pl-6">
								<div class="mb-2 h-2 w-32 bg-[#111]"></div>
								<div class="h-4 w-full bg-[#111]"></div>
							</div>
						{/each}
					</div>
				{:else if recentNotes.length === 0}
					<div class="py-8 text-center text-[#444]">SIN_NOTAS — AGREGA CONTEXTO A TUS CONTACTOS</div>
				{:else}
					<div class="ml-2 flex flex-col gap-8">
						{#each recentNotes as note, i (note.id)}
							<div class="relative pl-6">
								<!-- Left accent bar -->
								<div class="absolute left-0 top-0 h-full w-1"
									style={noteBorderColors[i] ?? 'background:#222;'}></div>

								<div class="mb-2 text-[9px] tracking-widest text-[#555]">
									NOTAS // CRM_ENTRY // {timeAgo(note.created)}
								</div>
								<div class="mb-3 font-sans text-[13px] normal-case tracking-wide text-[#ccc]"
									style="letter-spacing:0.01em;">
									{#if note.expand?.contact}
										<a href="/contacts/{note.expand.contact.id}"
											class="font-bold text-white hover:text-[#aaa] transition-colors">
											{note.expand.contact.name}
										</a>:&nbsp;
									{/if}
									"{truncate(note.content)}"
								</div>
								<div class="flex gap-2">
									{#if note.expand?.contact}
										<a href="/contacts/{note.expand.contact.id}"
											class="border border-[#222] px-2 py-1 text-[9px] tracking-widest text-[#666] hover:text-white transition-colors">
											VER_CONTACTO
										</a>
									{/if}
									<span class="border border-[#222] px-2 py-1 text-[9px] tracking-widest text-[#666]">
										CRM
									</span>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

		</div>

		<!-- ════════════════════════════════════ RIGHT COL (span 4) ══════════ -->
		<div class="flex flex-col gap-10 lg:col-span-4">

			<!-- ── Section 4: Priority tasks ────────────────────────────────── -->
			<div class="relative border border-[#1a1a1a] bg-[#090909] p-6 pt-8">
				<div class="absolute -left-3 -top-3 z-10 flex h-4 w-4 items-center justify-center
					bg-white text-[10px] font-bold text-black">4</div>

				<div class="mb-6 flex items-center justify-between">
					<div class="tracking-widest text-[#888]">TAREAS_URGENTES</div>
					<div class="text-[9px] tracking-widest text-[#555]">
						{priorityTasks.length} / {tasksBarsRaw[0] + tasksBarsRaw[1]}
					</div>
				</div>

				{#if loading}
					{#each Array(3) as _}
						<div class="mb-3 h-14 border border-[#1a1a1a] bg-[#111]"></div>
					{/each}
				{:else if priorityTasks.length === 0}
					<div class="py-8 text-center text-[#444]">SIN_URGENTES</div>
				{:else}
					<div class="mb-6 flex flex-col gap-3">
						{#each priorityTasks as task (task.id)}
							<div class="flex items-start gap-4 border border-[#1a1a1a] p-4">
								<div class="mt-0.5 h-3 w-3 flex-shrink-0 bg-white"></div>
								<div>
									<div class="mb-1 font-sans text-[13px] normal-case text-white"
										style="letter-spacing:-0.01em;">
										{task.title}
									</div>
									<div class="text-[9px] tracking-widest text-[#555]">
										{task.priority.toUpperCase()} // {typeLabel(task.type)}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				<a href="/tasks"
					class="w-max cursor-pointer text-[9px] tracking-widest text-[#555] hover:text-white transition-colors">
					+ VER_TODAS_TAREAS
				</a>
			</div>

			<!-- ── Section 5: Pipeline / Revenue ─────────────────────────────── -->
			<div class="relative border border-[#1a1a1a] bg-[#090909] p-6 pt-8">
				<div class="absolute -left-3 -top-3 z-10 flex h-4 w-4 items-center justify-center
					bg-white text-[10px] font-bold text-black">5</div>

				<div class="mb-8 tracking-widest text-[#888]">PIPELINE // INGRESOS</div>

				<div class="flex flex-col gap-6">

					<div>
						<div class="mb-2 text-[9px] tracking-widest text-[#444]">PIPELINE_TOTAL [USD]</div>
						<div class="flex items-center gap-3 border border-[#222] p-3">
							<span class="text-[#555]">$</span>
							<span class="text-sm font-bold tracking-wider text-white" style="font-family:system-ui;">
								{loading ? '—' : openDealsValue.toLocaleString('es', { maximumFractionDigits: 0 })}
							</span>
						</div>
					</div>

					<div class="flex gap-4">
						<div class="flex-1">
							<div class="mb-2 text-[9px] tracking-widest text-[#444]">ESTADO</div>
							<div class="border border-[#222] p-3">
								<span class="text-[11px] tracking-widest text-[#ccc]">ACTIVO</span>
							</div>
						</div>
						<div class="flex-1">
							<div class="mb-2 text-[9px] tracking-widest text-[#444]">NEGOCIOS</div>
							<div class="border border-[#222] p-3">
								<span class="text-[11px] tracking-widest text-[#ccc]">
									{loading ? '—' : openDealsCount} OPEN
								</span>
							</div>
						</div>
					</div>

					<div class="mt-2">
						<div class="relative mb-4 border-b border-[#333] pb-2">
							<div class="absolute bottom-0 left-0 right-0 h-[1px] opacity-50"
								style="background: linear-gradient(to right, #ff3333, #ffaa00, #00ffaa, #00aaff, #aa00ff);"></div>
							<div class="flex items-end justify-between">
								<div class="mb-1 text-[9px] tracking-widest text-[#555]">INGRESOS_GANADOS</div>
								<div class="flex items-baseline gap-1">
									<span class="font-mono text-xl text-[#555]">$</span>
									<span class="font-sans text-2xl font-bold"
										style="background: linear-gradient(to right, #ff3333, #ffaa00, #00ffaa, #00aaff, #aa00ff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; letter-spacing:-0.02em;">
										{loading ? '0' : wonDealsValue.toLocaleString('es', { maximumFractionDigits: 0 })}
									</span>
								</div>
							</div>
						</div>

						<div class="flex justify-between">
							<div>
								<div class="mb-1 text-[8px] tracking-widest text-[#444]">LEADS</div>
								<div class="text-[10px] tracking-wider text-[#ccc]">{loading ? '—' : dealLeadCount}</div>
							</div>
							<div>
								<div class="mb-1 text-[8px] tracking-widest text-[#444]">PROPUESTAS</div>
								<div class="text-[10px] tracking-wider text-[#ccc]">{loading ? '—' : dealProposalCount}</div>
							</div>
							<div class="text-right">
								<div class="mb-1 text-[8px] tracking-widest text-[#444]">NEGOCIANDO</div>
								<div class="text-[10px] tracking-wider text-[#ccc]">{loading ? '—' : dealNegCount}</div>
							</div>
						</div>
					</div>

				</div>
			</div>

		</div>
	</div>
</div>
