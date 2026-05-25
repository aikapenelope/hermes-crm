<script lang="ts">
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { FormField, Input, Select, Textarea, Btn } from '$lib/ui';

	interface Props {
		task?: Record<string, unknown> | null;
		defaultContact?: string;
		onSave: (record: Record<string, unknown>) => void;
		onClose: () => void;
	}

	let { task = null, defaultContact = '', onSave, onClose }: Props = $props();

	let title       = $state('');
	let type        = $state('task');
	let status      = $state('todo');
	let priority    = $state('medium');
	let dueDate     = $state('');
	let contact     = $state('');
	let deal        = $state('');
	let description = $state('');

	$effect(() => {
		title       = String(task?.title       ?? '');
		type        = String(task?.type        ?? 'task');
		status      = String(task?.status      ?? 'todo');
		priority    = String(task?.priority    ?? 'medium');
		dueDate     = task?.due_date ? String(task.due_date).slice(0, 10) : '';
		contact     = String(task?.contact     ?? defaultContact);
		deal        = String(task?.deal        ?? '');
		description = String(task?.description ?? '');
	});

	let errors = $state<Record<string, string>>({});
	let saving = $state(false);

	type ContactOption = { id: string; name: string; email: string };
	type DealOption    = { id: string; title: string };

	let contacts = $state<ContactOption[]>([]);
	let deals    = $state<DealOption[]>([]);

	onMount(async () => {
		const [c, d] = await Promise.all([
			pb.collection('contacts').getFullList<ContactOption>({
				fields: 'id,name,email', sort: 'name', batchSize: 200,
			}).catch(() => []),
			pb.collection('deals').getFullList<DealOption>({
				fields: 'id,title', sort: '-created', batchSize: 200,
			}).catch(() => []),
		]);
		contacts = c;
		deals = d;
	});

	function validate(): boolean {
		const e: Record<string, string> = {};
		if (!title.trim()) e.title = 'El título es requerido';
		errors = e;
		return Object.keys(e).length === 0;
	}

	async function save() {
		if (!validate()) return;
		saving = true;
		try {
			const data = {
				title:       title.trim(),
				type:        type || null,
				status:      status || 'todo',
				priority:    priority || null,
				due_date:    dueDate || null,
				contact:     contact || null,
				deal:        deal || null,
				description: description.trim() || null,
			};
			const record = task?.id
				? await pb.collection('tasks').update(String(task.id), data)
				: await pb.collection('tasks').create(data);
			toast.success(task?.id ? 'Tarea actualizada' : 'Tarea creada');
			onSave(record as unknown as Record<string, unknown>);
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al guardar');
		} finally { saving = false; }
	}
</script>

<div class="space-y-4">
	<FormField label="Título" required error={errors.title}>
		<Input bind:value={title} placeholder="Ej. Llamar a María para seguimiento" error={!!errors.title} />
	</FormField>

	<div class="grid grid-cols-2 gap-3">
		<FormField label="Tipo">
			<Select bind:value={type}>
				<option value="task">Tarea</option>
				<option value="call">Llamada</option>
				<option value="email">Email</option>
				<option value="meeting">Reunión</option>
				<option value="demo">Demo</option>
				<option value="follow_up">Seguimiento</option>
			</Select>
		</FormField>
		<FormField label="Prioridad">
			<Select bind:value={priority}>
				<option value="low">Baja</option>
				<option value="medium">Media</option>
				<option value="high">Alta</option>
				<option value="urgent">Urgente</option>
			</Select>
		</FormField>
	</div>

	<div class="grid grid-cols-2 gap-3">
		<FormField label="Estado">
			<Select bind:value={status}>
				<option value="todo">Pendiente</option>
				<option value="in_progress">En progreso</option>
				<option value="done">Completada</option>
				<option value="cancelled">Cancelada</option>
			</Select>
		</FormField>
		<FormField label="Fecha límite">
			<Input type="date" bind:value={dueDate} />
		</FormField>
	</div>

	<FormField label="Contacto">
		<Select bind:value={contact}>
			<option value="">Sin contacto</option>
			{#each contacts as c}
				<option value={c.id}>{c.name || c.email}</option>
			{/each}
		</Select>
	</FormField>

	<FormField label="Negocio">
		<Select bind:value={deal}>
			<option value="">Sin negocio</option>
			{#each deals as d}
				<option value={d.id}>{d.title}</option>
			{/each}
		</Select>
	</FormField>

	<FormField label="Descripción">
		<Textarea bind:value={description} placeholder="Detalles de la tarea…" rows={3} />
	</FormField>

	<div class="flex justify-end gap-2 pt-2">
		<Btn variant="secondary" onclick={onClose}>Cancelar</Btn>
		<Btn variant="primary" loading={saving} onclick={save}>
			{task?.id ? 'Guardar cambios' : 'Crear tarea'}
		</Btn>
	</div>
</div>
