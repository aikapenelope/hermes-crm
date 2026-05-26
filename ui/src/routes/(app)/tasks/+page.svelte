<script lang="ts">
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { Sheet, Modal, Btn, Badge, Skeleton, Empty } from '$lib/ui';
	import TaskForm from '$lib/forms/TaskForm.svelte';
	import { CheckSquare, Plus, Check, Pencil, Trash2 } from 'lucide-svelte';
	import type { ListResult } from 'pocketbase';

	type Task = {
		id: string; title: string; type: string; status: string;
		priority: string; due_date: string; description: string;
		expand?: { contact?: { id: string; name: string } };
	};

	let result      = $state<ListResult<Task> | null>(null);
	let loading     = $state(true);
	let filterStatus   = $state('');
	let filterPriority = $state('');
	let page        = $state(1);
	const perPage   = 25;

	// Sheet
	let sheetOpen  = $state(false);
	let editingTask = $state<Task | null>(null);

	// Delete
	let deleteTarget = $state<Task | null>(null);
	let deleting     = $state(false);

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

	onMount(fetchTasks);
	$effect(() => { filterStatus; filterPriority; page; fetchTasks(); });

	function openCreate() { editingTask = null; sheetOpen = true; }
	function openEdit(t: Task) { editingTask = t; sheetOpen = true; }
	function handleSaved() { sheetOpen = false; fetchTasks(); }

	async function markDone(task: Task, e: MouseEvent) {
		e.stopPropagation();
		const newStatus = task.status === 'done' ? 'todo' : 'done';
		try {
			await pb.collection('tasks').update(task.id, { status: newStatus });
			result = result
				? { ...result, items: result.items.map(t => t.id === task.id ? { ...t, status: newStatus } : t) }
				: null;
			if (newStatus === 'done') toast.success('Tarea completada');
		} catch (e: unknown) { toast.error('Error'); }
	}

	async function confirmDelete() {
		if (!deleteTarget) return;
		deleting = true;
		try {
			await pb.collection('tasks').delete(deleteTarget.id);
			toast.success('Tarea eliminada');
			deleteTarget = null;
			fetchTasks();
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error');
		} finally { deleting = false; }
	}

	const priorityBadge: Record<string, 'slate' | 'blue' | 'amber' | 'red'> = {
		low: 'slate', medium: 'blue', high: 'amber', urgent: 'red',
	};
	const priorityLabel: Record<string, string> = {
		low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente',
	};
	const typeLabel: Record<string, string> = {
		call: '📞', email: '📧', meeting: '👥', demo: '💻', task: '✓', follow_up: '🔄',
	};

	function isOverdue(t: Task) {
		return t.due_date && !['done','cancelled'].includes(t.status) && new Date(t.due_date) < new Date();
	}
</script>

<svelte:head><title>Tareas — Hermes CRM</title></svelte:head>

<div class="flex-1 p-5 md:p-6">
	<div class="mb-5 flex items-center justify-between">
		<div>
			<h1>Tareas</h1>
			<p class="mt-0.5 text-sm text-[#888]">{result ? `${result.totalItems} tareas` : '…'}</p>
		</div>
		<Btn variant="primary" onclick={openCreate}>
			{#snippet icon()}<Plus class="h-4 w-4" />{/snippet}
			Nueva tarea
		</Btn>
	</div>

	<div class="mb-4 flex gap-3 flex-wrap">
		<select bind:value={filterStatus}
			class="rounded-lg border border-[#222] bg-[#0a0a0a] px-3 py-2 text-sm text-[#888] outline-none focus:border-white">
			<option value="">Todos los estados</option>
			<option value="todo">Pendiente</option>
			<option value="in_progress">En progreso</option>
			<option value="done">Completadas</option>
			<option value="cancelled">Canceladas</option>
		</select>
		<select bind:value={filterPriority}
			class="rounded-lg border border-[#222] bg-[#0a0a0a] px-3 py-2 text-sm text-[#888] outline-none focus:border-white">
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
						{#snippet icon()}<Plus class="h-4 w-4" />{/snippet}
						Crear primera tarea
					</Btn>
				{/if}
			{/snippet}
		</Empty>
	{:else if result}
		<div class="space-y-1.5">
			{#each result.items as task (task.id)}
				<div
					class="group flex items-center gap-3 border border-[#1a1a1a] bg-[#090909] px-4 py-3
						transition-colors hover:border-[#333]
						{task.status === 'done' || task.status === 'cancelled' ? 'opacity-60' : ''}"
				>
					<!-- Checkbox -->
					<button
						onclick={(e) => markDone(task, e)}
						class="flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all
							{task.status === 'done'
							? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
							: 'border-[#333] hover:border-emerald-500'}"
					>
						{#if task.status === 'done'}
							<Check class="h-3 w-3" />
						{/if}
					</button>

					<!-- Task info -->
					<button onclick={() => openEdit(task)} class="flex-1 min-w-0 text-left">
						<div class="flex items-center gap-2 flex-wrap">
							{#if task.type}
								<span class="text-sm" title={task.type}>{typeLabel[task.type] ?? ''}</span>
							{/if}
							<span class="text-sm font-medium {task.status === 'done' ? 'line-through text-[#555]' : 'text-white'}">
								{task.title}
							</span>
						</div>
						{#if task.expand?.contact}
							<a
								href="/contacts/{task.expand.contact.id}"
								onclick={(e) => e.stopPropagation()}
								class="text-xs text-[#555] hover:text-white"
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
							<span class="text-xs {isOverdue(task) ? 'font-medium text-rose-400' : 'text-[#555]'}">
								{task.due_date.slice(0, 10)}
							</span>
						{/if}
						<div class="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
							<button
								onclick={() => openEdit(task)}
								class="rounded p-1 text-[#555] hover:bg-[#111] hover:text-white"
							>
								<Pencil class="h-3.5 w-3.5" />
							</button>
							<button
								onclick={() => { deleteTarget = task; }}
								class="rounded p-1 text-[#555] hover:bg-red-900/40 hover:text-red-400"
							>
								<Trash2 class="h-3.5 w-3.5" />
							</button>
						</div>
					</div>
				</div>
			{/each}

			{#if result.totalPages > 1}
				<div class="flex items-center justify-between pt-2">
					<span class="text-xs text-[#555]">Página {result.page} de {result.totalPages}</span>
					<div class="flex gap-2">
						<Btn variant="ghost" size="sm" onclick={() => { page = page - 1; }} disabled={page <= 1}>← Anterior</Btn>
						<Btn variant="ghost" size="sm" onclick={() => { page = page + 1; }} disabled={page >= result.totalPages}>Siguiente →</Btn>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<Sheet
	open={sheetOpen}
	title={editingTask ? 'Editar tarea' : 'Nueva tarea'}
	description={editingTask ? 'Modifica los detalles de la tarea' : 'Crea una nueva tarea o recordatorio'}
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
