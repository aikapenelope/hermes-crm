<script lang="ts">
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { CheckSquare, Check } from 'lucide-svelte';
	import type { ListResult } from 'pocketbase';

	type Task = {
		id: string; title: string; type: string; status: string;
		priority: string; due_date: string; description: string;
		expand?: { contact?: { id: string; name: string } };
	};

	let result = $state<ListResult<Task> | null>(null);
	let loading = $state(true);
	let filterStatus = $state('');
	let filterPriority = $state('');
	let page = $state(1);
	const perPage = 25;

	async function fetchTasks() {
		loading = true;
		try {
			const filters: string[] = [];
			if (filterStatus) filters.push(`status = '${filterStatus}'`);
			if (filterPriority) filters.push(`priority = '${filterPriority}'`);
			result = await pb.collection('tasks').getList<Task>(page, perPage, {
				filter: filters.join(' && ') || undefined,
				sort: 'due_date,-created',
				expand: 'contact',
				fields: 'id,title,type,status,priority,due_date,description,expand',
			});
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al cargar tareas');
		} finally { loading = false; }
	}

	onMount(fetchTasks);
	$effect(() => { filterStatus; filterPriority; page; fetchTasks(); });

	async function markDone(task: Task) {
		try {
			await pb.collection('tasks').update(task.id, { status: 'done' });
			result = result ? {
				...result,
				items: result.items.map(t => t.id === task.id ? { ...t, status: 'done' } : t),
			} : null;
			toast.success('Tarea completada');
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error');
		}
	}

	const priorityColors: Record<string, string> = {
		low: 'text-slate-400', medium: 'text-blue-400',
		high: 'text-amber-400', urgent: 'text-rose-400',
	};
	const typeLabels: Record<string, string> = {
		call: 'Llamada', email: 'Email', meeting: 'Reunión',
		demo: 'Demo', task: 'Tarea', follow_up: 'Seguimiento',
	};

	function isOverdue(dueDate: string, status: string): boolean {
		if (!dueDate || status === 'done' || status === 'cancelled') return false;
		return new Date(dueDate) < new Date();
	}
</script>

<svelte:head><title>Tareas — Hermes CRM</title></svelte:head>

<div class="flex-1 p-6">
	<div class="mb-5 flex items-center justify-between">
		<div>
			<h1 class="text-xl font-semibold text-slate-100">Tareas</h1>
			<p class="text-sm text-slate-400">{result ? `${result.totalItems} tareas` : '…'}</p>
		</div>
		<button
			onclick={() => toast.info('Crear tarea — próximamente')}
			class="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
		>
			<CheckSquare class="h-4 w-4" /> Nueva tarea
		</button>
	</div>

	<div class="mb-4 flex gap-3 flex-wrap">
		<select bind:value={filterStatus}
			class="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-500">
			<option value="">Todos los estados</option>
			<option value="todo">Pendiente</option>
			<option value="in_progress">En progreso</option>
			<option value="done">Completadas</option>
			<option value="cancelled">Canceladas</option>
		</select>
		<select bind:value={filterPriority}
			class="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-500">
			<option value="">Todas las prioridades</option>
			<option value="urgent">Urgente</option>
			<option value="high">Alta</option>
			<option value="medium">Media</option>
			<option value="low">Baja</option>
		</select>
	</div>

	<div class="space-y-1.5">
		{#if loading && !result}
			<div class="flex items-center gap-2 py-4 text-sm text-slate-400">
				<div class="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500"></div>
				Cargando…
			</div>
		{:else if result && result.items.length === 0}
			<div class="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-500">Sin tareas</div>
		{:else if result}
			{#each result.items as task (task.id)}
				<div class="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 hover:border-slate-700 transition-colors
					{task.status === 'done' || task.status === 'cancelled' ? 'opacity-60' : ''}">
					<!-- Mark done button -->
					<button
						onclick={() => markDone(task)}
						disabled={task.status === 'done'}
						class="flex h-5 w-5 shrink-0 items-center justify-center rounded border
							{task.status === 'done' ? 'border-emerald-600 bg-emerald-900/50 text-emerald-400' : 'border-slate-600 hover:border-emerald-500 hover:text-emerald-400 text-slate-600'}
							transition-colors disabled:cursor-default"
					>
						{#if task.status === 'done'}<Check class="h-3 w-3" />{/if}
					</button>

					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 flex-wrap">
							<span class="text-sm font-medium {task.status === 'done' ? 'line-through text-slate-500' : 'text-slate-200'}">
								{task.title}
							</span>
							{#if task.type}
								<span class="text-xs text-slate-500">{typeLabels[task.type] ?? task.type}</span>
							{/if}
						</div>
						{#if task.expand?.contact}
							<a href="/contacts/{task.expand.contact.id}" class="text-xs text-blue-400 hover:text-blue-300">
								{task.expand.contact.name}
							</a>
						{/if}
					</div>

					<div class="flex items-center gap-3 shrink-0">
						{#if task.priority}
							<span class="text-xs font-medium {priorityColors[task.priority] ?? 'text-slate-400'}">
								{task.priority}
							</span>
						{/if}
						{#if task.due_date}
							<span class="text-xs {isOverdue(task.due_date, task.status) ? 'text-rose-400 font-medium' : 'text-slate-500'}">
								{task.due_date.slice(0, 10)}
							</span>
						{/if}
					</div>
				</div>
			{/each}

			{#if result.totalPages > 1}
				<div class="flex items-center justify-between pt-2">
					<span class="text-xs text-slate-500">Página {result.page} de {result.totalPages}</span>
					<div class="flex gap-2">
						<button onclick={() => { page = page - 1; }} disabled={page <= 1}
							class="rounded px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-40">← Anterior</button>
						<button onclick={() => { page = page + 1; }} disabled={page >= result.totalPages}
							class="rounded px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-40">Siguiente →</button>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>
