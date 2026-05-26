<script lang="ts">
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { FormField, Input, Select, Btn } from '$lib/ui';

	interface Props {
		goal?: Record<string, unknown> | null;
		onSave: (record: Record<string, unknown>) => void;
		onClose: () => void;
	}

	let { goal = null, onSave, onClose }: Props = $props();

	let metric  = $state('deals_won_count');
	let target  = $state('');
	let currency = $state('USD');
	let period  = $state('');
	let saving  = $state(false);
	let errors  = $state<Record<string, string>>({});

	$effect(() => {
		metric   = String(goal?.metric   ?? 'deals_won_count');
		target   = goal?.target != null ? String(goal.target) : '';
		currency = String(goal?.currency ?? 'USD');
		period   = String(goal?.period   ?? '');
	});

	const metricLabels: Record<string, string> = {
		deals_won_count:   'Negocios ganados (cantidad)',
		deals_won_value:   'Ingresos ganados (valor)',
		new_contacts:      'Nuevos contactos',
		new_deals:         'Nuevos negocios',
		activities_done:   'Actividades completadas',
	};

	const needsCurrency = $derived(metric === 'deals_won_value');

	function validate(): boolean {
		const e: Record<string, string> = {};
		if (!target || isNaN(Number(target)) || Number(target) <= 0)
			e.target = 'Ingresa un objetivo mayor a 0';
		if (!period.trim())
			e.period = 'Ingresa el período (ej: 2026-Q2, 2026-05, all-time)';
		errors = e;
		return Object.keys(e).length === 0;
	}

	async function save() {
		if (!validate()) return;
		saving = true;
		try {
			const data = {
				metric,
				target:   Number(target),
				currency: needsCurrency ? currency : null,
				period:   period.trim(),
				owner:    pb.authStore.record?.id ?? null,
			};
			const record = goal?.id
				? await pb.collection('goals').update(String(goal.id), data)
				: await pb.collection('goals').create(data);
			toast.success(goal?.id ? 'Meta actualizada' : 'Meta creada');
			onSave(record as unknown as Record<string, unknown>);
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al guardar');
		} finally { saving = false; }
	}
</script>

<div class="space-y-4 uppercase tracking-widest" style="font-size:11px;">
	<FormField label="Métrica">
		<Select bind:value={metric}>
			{#each Object.entries(metricLabels) as [val, lbl]}
				<option value={val}>{lbl}</option>
			{/each}
		</Select>
	</FormField>

	<div class="grid grid-cols-2 gap-3">
		<FormField label="Objetivo" error={errors.target}>
			<Input type="number" bind:value={target} placeholder="100" min="1" error={!!errors.target} />
		</FormField>
		{#if needsCurrency}
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
		{/if}
	</div>

	<FormField
		label="Período"
		error={errors.period}
		hint="Ej: 2026-Q2 · 2026-05 · 2026 · all-time"
	>
		<Input
			bind:value={period}
			placeholder="2026-Q2"
			error={!!errors.period}
		/>
	</FormField>

	<div class="flex justify-end gap-2 pt-2">
		<Btn variant="secondary" onclick={onClose}>Cancelar</Btn>
		<Btn variant="primary" loading={saving} onclick={save}>
			{goal?.id ? 'Guardar cambios' : 'Crear meta'}
		</Btn>
	</div>
</div>
