<script lang="ts">
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { sanitizeSearch } from '$lib/utils';

	// ── Types ─────────────────────────────────────────────────────────────────
	type Task = {
		id: string; title: string; type: string;
		status: string; priority: string; due_date: string;
		expand?: { contact?: { name: string } };
	};
	type CalDay = { date: Date; otherMonth: boolean };

	// ── Navigation state ──────────────────────────────────────────────────────
	const now     = new Date();
	let viewYear  = $state(now.getFullYear());
	let viewMonth = $state(now.getMonth()); // 0-indexed

	// ── Data ──────────────────────────────────────────────────────────────────
	let tasks         = $state<Task[]>([]);
	let loading       = $state(true);
	let selectedDate  = $state<Date | null>(null);
	let selectedTasks = $state<Task[]>([]);

	const MONTH_NAMES = [
		'ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
		'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE',
	];
	const DAY_NAMES = ['LUN','MAR','MIE','JUE','VIE','SAB','DOM'];

	// ── Calendar grid calculation ──────────────────────────────────────────────
	// Monday-first grid. Returns 35 or 42 cells.
	function getCalendarDays(year: number, month: number): CalDay[] {
		const firstDay     = new Date(year, month, 1);
		const lastDay      = new Date(year, month + 1, 0);
		const prevMonthEnd = new Date(year, month, 0).getDate();

		// Monday = 0 offset (JS getDay: 0=Sun,1=Mon → offset = (getDay()+6)%7)
		const startOffset = (firstDay.getDay() + 6) % 7;

		const days: CalDay[] = [];

		// Trailing days from previous month
		for (let i = startOffset - 1; i >= 0; i--) {
			days.push({ date: new Date(year, month - 1, prevMonthEnd - i), otherMonth: true });
		}
		// Current month
		for (let d = 1; d <= lastDay.getDate(); d++) {
			days.push({ date: new Date(year, month, d), otherMonth: false });
		}
		// Leading days from next month
		let next = 1;
		while (days.length % 7 !== 0) {
			days.push({ date: new Date(year, month + 1, next++), otherMonth: true });
		}
		return days;
	}

	const calDays = $derived(getCalendarDays(viewYear, viewMonth));

	// ── Load tasks for the visible month range ────────────────────────────────
	async function loadTasks(year: number, month: number) {
		loading = true;
		try {
			// Cover the full calendar grid (might include prev/next month days)
			const first = new Date(year, month - 1, 20); // 20 days before to cover grid start
			const last  = new Date(year, month + 1, 15); // 15 days after to cover grid end
			const fmt   = (d: Date) => d.toISOString().slice(0, 10);
			tasks = await pb.collection('tasks').getFullList<Task>({
				filter: `due_date >= '${fmt(first)}' && due_date <= '${fmt(last)}'`,
				sort:   'due_date',
				expand: 'contact',
				fields: 'id,title,type,status,priority,due_date,expand',
			});
		} catch { tasks = []; }
		finally { loading = false; }
	}

	onMount(() => loadTasks(viewYear, viewMonth));
	$effect(() => { loadTasks(viewYear, viewMonth); });

	// ── Tasks indexed by date string (YYYY-MM-DD) ─────────────────────────────
	const tasksByDate = $derived(() => {
		const map = new Map<string, Task[]>();
		for (const t of tasks) {
			const key = t.due_date.slice(0, 10);
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(t);
		}
		return map;
	});

	// ── Day helpers ───────────────────────────────────────────────────────────
	function dateKey(d: Date) {
		return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
	}
	function isToday(d: Date) {
		const t = new Date();
		return d.getDate()===t.getDate() && d.getMonth()===t.getMonth() && d.getFullYear()===t.getFullYear();
	}
	function isSelected(d: Date) {
		return selectedDate ? dateKey(d) === dateKey(selectedDate) : false;
	}
	function isPast(d: Date) {
		const t = new Date(); t.setHours(0,0,0,0);
		return d < t;
	}

	// ── Select a day ──────────────────────────────────────────────────────────
	function selectDay(day: CalDay) {
		selectedDate  = day.date;
		selectedTasks = tasksByDate().get(dateKey(day.date)) ?? [];
	}

	// ── Navigate months ───────────────────────────────────────────────────────
	function prevMonth() {
		if (viewMonth === 0) { viewMonth = 11; viewYear--; }
		else viewMonth--;
	}
	function nextMonth() {
		if (viewMonth === 11) { viewMonth = 0; viewYear++; }
		else viewMonth++;
	}
	function goToday() {
		viewYear  = now.getFullYear();
		viewMonth = now.getMonth();
		selectedDate  = now;
		selectedTasks = tasksByDate().get(dateKey(now)) ?? [];
	}

	// ── Priority color dot ────────────────────────────────────────────────────
	const priorityDot: Record<string, string> = {
		urgent: 'bg-rose-500',
		high:   'bg-amber-500',
		medium: 'bg-white',
		low:    'bg-[#444]',
	};
	const statusOpacity: Record<string, string> = {
		done:      'opacity-40',
		cancelled: 'opacity-30',
		todo:      '',
		in_progress: '',
	};
	function typeEmoji(t: string): string {
		const m: Record<string, string> = {
			call: '📞', email: '📧', meeting: '👥', demo: '💻', task: '·', follow_up: '↩',
		};
		return m[t] ?? '·';
	}

	const selectedDateStr = $derived(
		selectedDate
			? `${String(selectedDate.getDate()).padStart(2,'0')}.${String(selectedDate.getMonth()+1).padStart(2,'0')}.${selectedDate.getFullYear()}`
			: null
	);
</script>

<svelte:head><title>Calendario — Hermes CRM</title></svelte:head>

<div class="p-6 lg:p-8 uppercase tracking-widest" style="font-size:11px; min-height:100%;">

	<!-- ══════════════════════════════════════════════════════════════════════ -->
	<!-- HEADER                                                                 -->
	<!-- ══════════════════════════════════════════════════════════════════════ -->
	<div class="mb-8 flex items-center justify-between">
		<div>
			<div class="text-[10px] tracking-widest text-[#555]">CALENDAR // AGENDA</div>
			<div class="mt-1 font-sans text-xl font-bold text-white" style="letter-spacing:-0.02em; text-transform:none;">
				{MONTH_NAMES[viewMonth]} {viewYear}
			</div>
		</div>
		<div class="flex items-center gap-2">
			<button
				onclick={goToday}
				class="border border-[#333] px-3 py-1.5 text-[10px] tracking-widest text-[#888]
					hover:border-[#555] hover:text-white transition-colors"
			>HOY</button>
			<button
				onclick={prevMonth}
				class="border border-[#1a1a1a] px-3 py-1.5 text-[#888] hover:text-white hover:border-[#333] transition-colors"
			>←</button>
			<button
				onclick={nextMonth}
				class="border border-[#1a1a1a] px-3 py-1.5 text-[#888] hover:text-white hover:border-[#333] transition-colors"
			>→</button>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">

		<!-- ═══════════════════════════════════════ CALENDAR GRID ═══════════ -->
		<div class="relative border border-[#1a1a1a] bg-[#090909]">
			{#if loading}
				<div class="absolute inset-0 flex items-center justify-center text-[#444]">
					CARGANDO TAREAS…
				</div>
			{/if}

			<!-- Day headers -->
			<div class="grid grid-cols-7 border-b border-[#1a1a1a]">
				{#each DAY_NAMES as day}
					<div class="border-r border-[#1a1a1a] px-2 py-2 text-center text-[9px] text-[#444] last:border-r-0">
						{day}
					</div>
				{/each}
			</div>

			<!-- Calendar cells -->
			<div class="grid grid-cols-7">
				{#each calDays as day, i}
					{@const key   = dateKey(day.date)}
					{@const dtasks = tasksByDate().get(key) ?? []}
					{@const today  = isToday(day.date)}
					{@const sel    = isSelected(day.date)}
					{@const past   = isPast(day.date) && !today}

					<button
						onclick={() => selectDay(day)}
						class="group relative min-h-[72px] border-b border-r border-[#1a1a1a] p-1.5 text-left
							transition-colors hover:bg-[#111]
							{(i + 1) % 7 === 0 ? 'border-r-0' : ''}
							{Math.floor(i / 7) === Math.floor((calDays.length - 1) / 7) ? 'border-b-0' : ''}
							{sel ? 'bg-[#111]' : ''}
						"
					>
						<!-- Day number -->
						<div class="mb-1 flex items-center justify-between">
							<span class="
								text-[10px] font-bold
								{today  ? 'text-white' : ''}
								{sel && !today ? 'text-white' : ''}
								{day.otherMonth ? 'text-[#2a2a2a]' : past && !today ? 'text-[#444]' : !today ? 'text-[#666]' : ''}
							">
								{day.date.getDate()}
							</span>
							<!-- Today indicator: rainbow dot -->
							{#if today}
								<div class="h-1.5 w-1.5 rounded-full"
									style="background: linear-gradient(135deg, #ff3333, #ffaa00, #00ffaa, #00aaff, #aa00ff);">
								</div>
							{/if}
						</div>

						<!-- Task indicators -->
						{#if dtasks.length > 0 && !day.otherMonth}
							<div class="space-y-0.5">
								{#each dtasks.slice(0, 3) as t}
									<div class="flex items-center gap-1 {statusOpacity[t.status] ?? ''}">
										<div class="h-1 w-1 shrink-0 rounded-full {priorityDot[t.priority] ?? 'bg-[#444]'}"></div>
										<span class="truncate text-[8px] normal-case text-[#888]" style="letter-spacing:0;">
											{t.title}
										</span>
									</div>
								{/each}
								{#if dtasks.length > 3}
									<div class="text-[8px] text-[#444]">+{dtasks.length - 3} más</div>
								{/if}
							</div>
						{/if}

						<!-- Rainbow top line on selected day -->
						{#if sel}
							<div class="absolute top-0 left-0 right-0 h-[2px]"
								style="background: linear-gradient(to right, #ff3333, #ffaa00, #00ffaa, #00aaff, #aa00ff);">
							</div>
						{/if}
					</button>
				{/each}
			</div>
		</div>

		<!-- ═══════════════════════════════════════ DAY DETAIL ══════════════ -->
		<div class="flex flex-col gap-4">
			<!-- Selected day header -->
			<div class="border border-[#1a1a1a] bg-[#090909] p-4">
				{#if selectedDateStr}
					<div class="text-[9px] tracking-widest text-[#555]">DÍA SELECCIONADO</div>
					<div class="mt-1 font-sans text-lg font-bold text-white" style="letter-spacing:-0.01em; text-transform:none;">
						{selectedDateStr}
					</div>
					<div class="mt-0.5 text-[9px] text-[#444]">
						{selectedTasks.length} TAREA{selectedTasks.length !== 1 ? 'S' : ''}
					</div>
				{:else}
					<div class="text-[#444]">SELECCIONA UN DÍA</div>
				{/if}
			</div>

			<!-- Task list for selected day -->
			{#if selectedTasks.length > 0}
				<div class="border border-[#1a1a1a] bg-[#090909]">
					<div class="border-b border-[#1a1a1a] px-4 py-2.5 text-[9px] tracking-widest text-[#555]">
						TAREAS DEL DÍA
					</div>
					<ul class="divide-y divide-[#1a1a1a]">
						{#each selectedTasks as task (task.id)}
							<a
								href="/tasks"
								class="flex items-start gap-3 px-4 py-3 hover:bg-[#111] transition-colors
									{statusOpacity[task.status] ?? ''}"
							>
								<div class="mt-1 h-2 w-2 shrink-0 rounded-full {priorityDot[task.priority] ?? 'bg-[#444]'}"></div>
								<div class="min-w-0 flex-1">
									<p class="truncate normal-case text-[12px] text-white" style="letter-spacing:0;">
										{task.title}
									</p>
									<div class="mt-0.5 flex items-center gap-2">
										<span class="text-[8px] text-[#444]">{task.type.toUpperCase()}</span>
										{#if task.status === 'done'}
											<span class="text-[8px] text-emerald-600">DONE</span>
										{:else if task.status === 'in_progress'}
											<span class="text-[8px] text-white">IN_PROGRESS</span>
										{/if}
									</div>
									{#if task.expand?.contact}
										<div class="mt-0.5 text-[8px] text-[#555]">
											{task.expand.contact.name}
										</div>
									{/if}
								</div>
							</a>
						{/each}
					</ul>
				</div>
			{:else if selectedDate}
				<div class="border border-[#1a1a1a] bg-[#090909] px-4 py-8 text-center text-[#444]">
					SIN_TAREAS
				</div>
			{/if}

			<!-- Legend -->
			<div class="border border-[#1a1a1a] bg-[#090909] p-4">
				<div class="mb-3 text-[9px] tracking-widest text-[#555]">PRIORIDAD // LEYENDA</div>
				<div class="space-y-2">
					{#each [['urgent','URGENTE','bg-rose-500'],['high','ALTA','bg-amber-500'],['medium','MEDIA','bg-white'],['low','BAJA','bg-[#444]']] as [key,label,cls]}
						<div class="flex items-center gap-2">
							<div class="h-1.5 w-1.5 rounded-full {cls}"></div>
							<span class="text-[9px] text-[#666]">{label}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>
