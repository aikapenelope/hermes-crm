<script lang="ts">
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { FormField, Input, Select, Textarea, Btn } from '$lib/ui';

	interface Props {
		deal?: Record<string, unknown> | null;
		defaultStage?: string;
		defaultContact?: string;
		onSave: (record: Record<string, unknown>) => void;
		onClose: () => void;
	}

	let { deal = null, defaultStage = 'lead', defaultContact = '', onSave, onClose }: Props = $props();

	let title        = $state('');
	let value        = $state('');
	let currency     = $state('USD');
	let stage        = $state('lead');
	let probability  = $state('');
	let expectedClose = $state('');
	let contact      = $state('');
	let company      = $state('');
	let description  = $state('');

	$effect(() => {
		title         = String(deal?.title         ?? '');
		value         = deal?.value != null ? String(deal.value) : '';
		currency      = String(deal?.currency      ?? 'USD');
		stage         = String(deal?.stage         ?? defaultStage);
		probability   = deal?.probability != null ? String(deal.probability) : '';
		expectedClose = deal?.expected_close ? String(deal.expected_close).slice(0, 10) : '';
		contact       = String(deal?.contact       ?? defaultContact);
		company       = String(deal?.company       ?? '');
		description   = String(deal?.description   ?? '');
	});

	let errors  = $state<Record<string, string>>({});
	let saving  = $state(false);

	type ContactOption = { id: string; name: string; email: string };
	type CompanyOption = { id: string; name: string };
	type PipelineOption = { id: string; name: string };

	let contacts  = $state<ContactOption[]>([]);
	let companies = $state<CompanyOption[]>([]);
	let pipelines = $state<PipelineOption[]>([]);

	onMount(async () => {
		const [c, comp, pip] = await Promise.all([
			pb.collection('contacts').getFullList<ContactOption>({
				fields: 'id,name,email', sort: 'name', batchSize: 200,
			}).catch(() => []),
			pb.collection('companies').getFullList<CompanyOption>({
				fields: 'id,name', sort: 'name',
			}).catch(() => []),
			pb.collection('pipelines').getFullList<PipelineOption>({
				fields: 'id,name', sort: 'name',
			}).catch(() => []),
		]);
		contacts = c;
		companies = comp;
		pipelines = pip;
	});

	function validate(): boolean {
		const e: Record<string, string> = {};
		if (!title.trim()) e.title = 'El título es requerido';
		if (value && isNaN(Number(value))) e.value = 'Debe ser un número';
		errors = e;
		return Object.keys(e).length === 0;
	}

	async function save() {
		if (!validate()) return;
		saving = true;
		try {
			const data = {
				title:          title.trim(),
				value:          value ? Number(value) : null,
				currency:       currency || null,
				stage:          stage || 'lead',
				probability:    probability ? Number(probability) : null,
				expected_close: expectedClose || null,
				contact:        contact || null,
				company:        company || null,
				description:    description.trim() || null,
			};
			const record = deal?.id
				? await pb.collection('deals').update(String(deal.id), data)
				: await pb.collection('deals').create(data);
			toast.success(deal?.id ? 'Negocio actualizado' : 'Negocio creado');
			onSave(record as unknown as Record<string, unknown>);
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al guardar');
		} finally { saving = false; }
	}
</script>

<div class="space-y-4">
	<FormField label="Título del negocio" required error={errors.title}>
		<Input bind:value={title} placeholder="Ej. Propuesta Aurora Pro" error={!!errors.title} />
	</FormField>

	<div class="grid grid-cols-2 gap-3">
		<FormField label="Valor" error={errors.value}>
			<Input type="number" bind:value={value} placeholder="0" min="0" error={!!errors.value} />
		</FormField>
		<FormField label="Moneda">
			<Select bind:value={currency}>
				<option value="USD">USD ($)</option>
				<option value="COP">COP</option>
				<option value="EUR">EUR (€)</option>
				<option value="MXN">MXN</option>
				<option value="BRL">BRL</option>
				<option value="ARS">ARS</option>
			</Select>
		</FormField>
	</div>

	<div class="grid grid-cols-2 gap-3">
		<FormField label="Etapa">
			<Select bind:value={stage}>
				<option value="lead">Lead</option>
				<option value="qualified">Calificado</option>
				<option value="proposal">Propuesta</option>
				<option value="negotiation">Negociación</option>
				<option value="won">Ganado</option>
				<option value="lost">Perdido</option>
			</Select>
		</FormField>
		<FormField label="Probabilidad (%)">
			<Input type="number" bind:value={probability} placeholder="50" min="0" max="100" />
		</FormField>
	</div>

	<FormField label="Cierre estimado">
		<Input type="date" bind:value={expectedClose} />
	</FormField>

	<FormField label="Contacto">
		<Select bind:value={contact}>
			<option value="">Sin contacto</option>
			{#each contacts as c}
				<option value={c.id}>{c.name || c.email}</option>
			{/each}
		</Select>
	</FormField>

	<FormField label="Empresa">
		<Select bind:value={company}>
			<option value="">Sin empresa</option>
			{#each companies as c}
				<option value={c.id}>{c.name}</option>
			{/each}
		</Select>
	</FormField>

	<FormField label="Descripción">
		<Textarea bind:value={description} placeholder="Detalles del negocio…" rows={3} />
	</FormField>

	<div class="flex justify-end gap-2 pt-2">
		<Btn variant="secondary" onclick={onClose}>Cancelar</Btn>
		<Btn variant="primary" loading={saving} onclick={save}>
			{deal?.id ? 'Guardar cambios' : 'Crear negocio'}
		</Btn>
	</div>
</div>
