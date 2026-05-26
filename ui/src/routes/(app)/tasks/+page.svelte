<script lang="ts">
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { Sheet, Modal, Btn, Badge, Skeleton, Empty } from '$lib/ui';
	import TaskForm from '$lib/forms/TaskForm.svelte';
	import { CheckSquare, Plus, Check, Pencil, Trash2, List, LayoutGrid } from 'lucide-svelte';
	import type { ListResult } from 'pocketbase';

	type Task = {
		id: string; title: string; type: string; status: string;
		priority: string; due_date: string; description: string;
		expand?: { contact?: { id: string; name: string } };
	};

	// ── View mode: list or kanban ────────────────────────────────────────────
	let viewMode: 'list' | 'kanban' = $state('list');

	// ── List state ───────────────────────────────────────────────────────────
	let result         = $state<ListResult<Task> | null>(null);
	let loading        = $state(true);
	let filterStatus   = $state('');
	let filterPriority = $state('');
	let page           = $state(1);
	const perPage      = 25;

	// ── Kanban state ─────────────────────────────────────────────────────────
	let allTasks        = $state<Task[]>([]);
	let kanbanLoading   = $state(false);
	let movingId        = $state<string | null>(null);

	const KANBAN_COLS: { id: string; label: string; accent: string }[] = [
		{ id: 'todo',        label: 'PENDIENTE',  accent: 'border-[#333]' },
		{ id: 'in_progress', label: 'EN PROGRESO', accent: 'border-amber-500/50' },
		{ id: 'done',        label: 'COMPLETADO', accent: 'border-emerald-500/50' },
		{ id: 'cancelled',   label: 'CANCELADO',  accent: 'border-[#222]' },
	];

	// ── Sheet ─────────────────────────────────────────────────────────────────
	let sheetOpen   = $state(false);
	let editingTask = $state<Task | null>(null);

	// ── Delete ────────────────────────────────────────────────────────────────
	let deleteTarget = $state<Task | null>(null);
	let deleting     = $state(false);

	// ── Fetch (list mode) ─────────────────────────────────────────────────────
	async function fetchTasks() {
		loading = true;
		try {
			const filters: string[] = [];
			if (filterStatus)   filters.push(`status = '${filterStatus}'`);
			if (filterPriority) filters.push(`priority = '${filterPriority}'`);
			result = await pb.collection('tasks').getList<Task>(page, perPage, {
				filter: filters.join(' && ') || undefined,
				sort: 'due_date,-created',
				expand: 'contact',
			});
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error');
		} finally { loading = false; }
	}

	// ── Fetch (kanban mode) ───────────────────────────────────────────────────
	async function fetchAllTasks() {
		kanbanLoading = true;
		try {
			allTasks = await pb.collection('tasks').getFullList<Task>({
				sort: 'due_date,-created',
				expand: 'contact',
			});
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error');
		} finally { kanbanLoading = false; }
	}

	onMount(fetchTasks);
	$effect(() => { filterStatus; filterPriority; page; fetchTasks(); });
	$effect(() => { if (viewMode === 'kanban') fetchAllTasks(); });

	function openCreate() { editingTask = null; sheetOpen = true; }
	function openEdit(t: Task) { editingTask = t; sheetOpen = true; }
	function handleSaved() { sheetOpen = false; fetchTasks(); fetchAllTasks(); }

	// ── Mark done ─────────────────────────────────────────────────────────────
	async function markDone(task: Task, e: MouseEvent) {
		e.stopPropagation();
		const newStatus = task.status === 'done' ? 'todo' : 'done';
		try {
			await pb.collection('tasks').update(task.id, { status: newStatus });
			result = result
				? { ...result, items: result.items.map(t => t.id === task.id ? { ...t, status: newStatus } : t) }
				: null;
			allTasks = allTasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t);
			if (newStatus === 'done') toast.success('Tarea completada');
		} catch { toast.error('Error'); }
	}

	// ── Move task to different status (Kanban) ────────────────────────────────
	async function moveTask(task: Task, newStatus: string) {
		if (task.status === newStatus) return;
		movingId = task.id;
		try {
			await pb.collection('tasks').update(task.id, { status: newStatus });
			allTasks = allTasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t);
		} catch { toast.error('Error al mover tarea'); }
		finally { movingId = null; }
	}

	// ── Delete ────────────────────────────────────────────────────────────────
	async function confirmDelete() {
		if (!deleteTarget) return;
		deleting = true;
		try {
			await pb.collection('tasks').delete(deleteTarget.id);
			toast.success('Tarea eliminada');
			deleteTarget = null;
			fetchTasks();
			fetchAllTasks();
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error');
		} finally { deleting = false; }
	}

	// ── Helpers ───────────────────────────────────────────────────────────────
	const priorityBadge: Record<string, 'slate' | 'blue' | 'amber' | 'red'> = {
		low: 'slate', medium: 'blue', high: 'amber', urgent: 'red',
	};
	const priorityLabel: Record<string, string> = {
		low: 'BAJA', medium: 'MEDIA', high: 'ALTA', urgent: 'URGENTE',
	};
	const typeLabel: Record<string, string> = {
		call: '📞', email: '📧', meeting: '👥', demo: '💻', task: '✓', follow_up: '↩',
	};

	function isOverdue(t: Task) {
		return t.due_date && !['done','cancelled'].includes(t.status) && new Date(t.due_date) < new Date();
	}

	// ── Kanban derived ────────────────────────────────────────────────────────
	const kanbanCols = $derived(
		KANBAN_COLS.map(col => ({
			...col,
			tasks: allTasks.filter(t => t.status === col.id),
		}))
	);

	// Status transitions for Kanban move buttons
	const statusNext: Record<string, string> = {
		todo: 'in_progress', in_progress: 'done', done: 'cancelled',
	};
	const statusPrev: Record<string, string> = {
		in_progress: 'todo', done: 'in_progress', cancelled: 'done',
	};
</script>

<svelte:head><title>Tareas — Hermes CRM</title></svelte:head>

<div class="flex-1 p-5 md:p-6">
	<!-- Header -->
	<div class="mb-5 flex items-center justify-between">
		<div>
			<h1>Tareas</h1>
			<p class="mt-0.5 text-[10px] text-[#555] tracking-widest uppercase">
				{result ? `${result.totalItems} tareas` : '…'}
			</p>
		</div>
		<div class="flex items-center gap-2">
			<!-- View toggle -->
			<div class="flex border border-[#222]">
				<button
					onclick={() => { viewMode = 'list'; }}
					class="flex items-center gap-1.5 px-3 py-2 text-[9px] tracking-widest uppercase transition-colors
						{viewMode === 'list' ? 'bg-white text-black' : 'text-[#555] hover:text-white'}"
				>
					<List class="h-3 w-3" /> Lista
				</button>
				<button
					onclick={() => { viewMode = 'kanban'; }}
					class="flex items-center gap-1.5 border-l border-[#222] px-3 py-2 text-[9px] tracking-widest uppercase transition-colors
						{viewMode === 'kanban' ? 'bg-white text-black' : 'text-[#555] hover:text-white'}"
				>
					<LayoutGrid class="h-3 w-3" /> Kanban
				</button>
			</div>
			<Btn variant="primary" onclick={openCreate}>
				{#snippet icon()}<Plus class="h-3.5 w-3.5" />{/snippet}
				Nueva tarea
			</Btn>
		</div>
	</div>

	<!-- ════════════════════════════════════════════════════════════════════ -->
	<!-- LIST VIEW                                                           -->
	<!-- ════════════════════════════════════════════════════════════════════ -->
	{#if viewMode === 'list'}
		<div class="mb-4 flex gap-3 flex-wrap">
			<select bind:value={filterStatus}
				class="border border-[#222] bg-[#0a0a0a] px-3 py-2 text-[10px] tracking-wide text-[#888] outline-none focus:border-white">
				<option value="">Todos los estados</option>
				<option value="todo">Pendiente</option>
				<option value="in_progress">En progreso</option>
				<option value="done">Completadas</option>
				<option value="cancelled">Canceladas</option>
			</select>
			<select bind:value={filterPriority}
				class="border border-[#222] bg-[#0a0a0a] px-3 py-2 text-[10px] tracking-wide text-[#888] outline-none focus:border-white">
				<option value="">Todas las prioridades</option>
				<option value="urgent">Urgente</option>
				<option value="high">Alta</option>
				<option value="medium">Media</option>
				<option value="low">Baja</option>
			</select>
		</div>

		{#if loading && !result}
			<Skeleton rows={8} />
		{:else if result && result.items.length === 0}
			<Empty
				title="Sin tareas"
				description={filterStatus || filterPriority ? 'Prueba con otro filtro' : 'Crea tu primera tarea para organizar tu trabajo'}
			>
				{#snippet icon()}<CheckSquare class="h-5 w-5" />{/snippet}
				{#snippet action()}
					{#if !filterStatus && !filterPriority}
						<Btn variant="primary" onclick={openCreate}>
							{#snippet icon()}<Plus class="h-3.5 w-3.5" />{/snippet}
							Crear primera tarea
						</Btn>
					{/if}
				{/snippet}
			</Empty>
		{:else if result}
			<div class="space-y-1">
				{#each result.items as task (task.id)}
					<div
						class="group flex items-center gap-3 border border-[#1a1a1a] bg-[#090909] px-4 py-3
							transition-colors hover:border-[#333]
							{task.status === 'done' || task.status === 'cancelled' ? 'opacity-50' : ''}"
					>
						<!-- Checkbox -->
						<button
							onclick={(e) => markDone(task, e)}
							class="flex h-4 w-4 shrink-0 items-center justify-center border transition-all
								{task.status === 'done'
								? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
								: 'border-[#333] hover:border-emerald-500'}"
						>
							{#if task.status === 'done'}
								<Check class="h-2.5 w-2.5" />
							{/if}
						</button>

						<!-- Task info -->
						<button onclick={() => openEdit(task)} class="flex-1 min-w-0 text-left">
							<div class="flex items-center gap-2">
								{#if task.type}
									<span class="text-xs shrink-0" title={task.type}>{typeLabel[task.type] ?? ''}</span>
								{/if}
								<span class="text-[11px] tracking-wide {task.status === 'done' ? 'line-through text-[#444]' : 'text-white'}">
									{task.title}
								</span>
							</div>
							{#if task.expand?.contact}
								<a
									href="/contacts/{task.expand.contact.id}"
									onclick={(e) => e.stopPropagation()}
									class="text-[9px] text-[#555] hover:text-white transition-colors tracking-widest uppercase"
								>
									{task.expand.contact.name}
								</a>
							{/if}
						</button>

						<!-- Meta + actions -->
						<div class="flex shrink-0 items-center gap-2">
							{#if task.priority}
								<Badge variant={priorityBadge[task.priority] ?? 'slate'} size="sm">
									{priorityLabel[task.priority] ?? task.priority}
								</Badge>
							{/if}
							{#if task.due_date}
								<span class="text-[9px] tracking-widest {isOverdue(task) ? 'text-rose-400' : 'text-[#444]'}">
									{task.due_date.slice(0, 10)}
								</span>
							{/if}
							<div class="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
								<button
									onclick={() => openEdit(task)}
									class="p-1 text-[#444] hover:bg-[#111] hover:text-white transition-colors"
								>
									<Pencil class="h-3 w-3" />
								</button>
								<button
									onclick={() => { deleteTarget = task; }}
									class="p-1 text-[#444] hover:bg-red-900/30 hover:text-red-400 transition-colors"
								>
									<Trash2 class="h-3 w-3" />
								</button>
							</div>
						</div>
					</div>
				{/each}

				{#if result.totalPages > 1}
					<div class="flex items-center justify-between pt-3">
						<span class="text-[9px] text-[#444] tracking-widest">PÁGINA {result.page} / {result.totalPages}</span>
						<div class="flex gap-2">
							<Btn variant="ghost" size="sm" onclick={() => { page = page - 1; }} disabled={page <= 1}>← ANTERIOR</Btn>
							<Btn variant="ghost" size="sm" onclick={() => { page = page + 1; }} disabled={page >= result.totalPages}>SIGUIENTE →</Btn>
						</div>
					</div>
				{/if}
			</div>
		{/if}

	<!-- ════════════════════════════════════════════════════════════════════ -->
	<!-- KANBAN VIEW                                                         -->
	<!-- ════════════════════════════════════════════════════════════════════ -->
	{:else if viewMode === 'kanban'}
		{#if kanbanLoading}
			<Skeleton rows={6} />
		{:else}
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{#each kanbanCols as col}
					<div class="flex flex-col border {col.accent} bg-[#090909]">
						<!-- Column header -->
						<div class="flex items-center justify-between border-b border-[#1a1a1a] px-3 py-2.5">
							<span class="text-[9px] tracking-widest text-[#888] uppercase">{col.label}</span>
							<span class="text-[9px] text-[#444]">{col.tasks.length}</span>
						</div>

						<!-- Cards -->
						<div class="flex flex-col gap-1.5 p-2 min-h-[200px]">
							{#each col.tasks as task (task.id)}
								<div
									class="group border border-[#1a1a1a] bg-[#0a0a0a] p-3 transition-colors hover:border-[#333]
										{movingId === task.id ? 'opacity-50' : ''}"
								>
									<!-- Card top: type + title -->
									<div class="flex items-start justify-between gap-2 mb-2">
										<button
											onclick={() => openEdit(task)}
											class="text-left flex-1 min-w-0"
										>
											<div class="flex items-center gap-1.5 mb-1">
												{#if task.type}
													<span class="text-xs shrink-0">{typeLabel[task.type] ?? ''}</span>
												{/if}
												{#if task.priority}
													<Badge variant={priorityBadge[task.priority] ?? 'slate'} size="sm">
														{priorityLabel[task.priority] ?? task.priority}
													</Badge>
												{/if}
											</div>
											<p class="text-[11px] text-white leading-tight">{task.title}</p>
										</button>
										<div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
											<button
												onclick={() => openEdit(task)}
												class="p-1 text-[#444] hover:text-white"
											><Pencil class="h-2.5 w-2.5" /></button>
											<button
												onclick={() => { deleteTarget = task; }}
												class="p-1 text-[#444] hover:text-red-400"
											><Trash2 class="h-2.5 w-2.5" /></button>
										</div>
									</div>

									<!-- Card bottom: contact + date + move buttons -->
									<div class="flex items-center justify-between gap-2">
										<div class="min-w-0">
											{#if task.expand?.contact}
												<div class="text-[8px] text-[#555] tracking-widest uppercase truncate">
													{task.expand.contact.name}
												</div>
											{/if}
											{#if task.due_date}
												<div class="text-[8px] {isOverdue(task) ? 'text-rose-400' : 'text-[#444]'}">
													{task.due_date.slice(0, 10)}
												</div>
											{/if}
										</div>
										<!-- Move buttons -->
										<div class="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
											{#if statusPrev[task.status]}
												<button
													onclick={() => moveTask(task, statusPrev[task.status])}
													class="border border-[#222] px-1.5 py-0.5 text-[7px] tracking-widest text-[#555]
														uppercase hover:border-[#444] hover:text-white transition-colors"
												>←</button>
											{/if}
											{#if statusNext[task.status]}
												<button
													onclick={() => moveTask(task, statusNext[task.status])}
													class="border border-[#222] px-1.5 py-0.5 text-[7px] tracking-widest text-[#555]
														uppercase hover:border-white hover:text-white transition-colors"
												>→</button>
											{/if}
										</div>
									</div>
								</div>
							{/each}

							{#if col.tasks.length === 0}
								<div class="flex flex-1 items-center justify-center py-8 text-[9px] text-[#2a2a2a] tracking-widest uppercase">
									VACÍO
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<Sheet
	open={sheetOpen}
	title={editingTask ? 'Editar tarea' : 'Nueva tarea'}
	description={editingTask ? 'Modifica los detalles' : 'Crea una nueva tarea'}
	onclose={() => { sheetOpen = false; }}
>
	{#snippet children()}
		<TaskForm
			task={editingTask}
			onSave={handleSaved}
			onClose={() => { sheetOpen = false; }}
		/>
	{/snippet}
</Sheet>

<Modal
	open={!!deleteTarget}
	title="Eliminar tarea"
	message="¿Eliminar '{deleteTarget?.title}'?"
	confirmLabel="Eliminar"
	variant="danger"
	loading={deleting}
	onconfirm={confirmDelete}
	oncancel={() => { deleteTarget = null; }}
/>
