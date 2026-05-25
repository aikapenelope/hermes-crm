<script lang="ts">
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { FormField, Input, Select, Textarea, Btn } from '$lib/ui';

	interface Props {
		company?: Record<string, unknown> | null;
		onSave: (record: Record<string, unknown>) => void;
		onClose: () => void;
	}

	let { company = null, onSave, onClose }: Props = $props();

	let name     = $state('');
	let industry = $state('');
	let website  = $state('');
	let city     = $state('');
	let country  = $state('');
	let size     = $state('');
	let notes    = $state('');

	$effect(() => {
		name     = String(company?.name     ?? '');
		industry = String(company?.industry ?? '');
		website  = String(company?.website  ?? '');
		city     = String(company?.city     ?? '');
		country  = String(company?.country  ?? '');
		size     = String(company?.size     ?? '');
		notes    = String(company?.notes    ?? '');
	});

	let errors = $state<Record<string, string>>({});
	let saving = $state(false);

	function validate(): boolean {
		const e: Record<string, string> = {};
		if (!name.trim()) e.name = 'El nombre es requerido';
		errors = e;
		return Object.keys(e).length === 0;
	}

	async function save() {
		if (!validate()) return;
		saving = true;
		try {
			const data = {
				name:     name.trim(),
				industry: industry || null,
				website:  website.trim() || null,
				city:     city.trim() || null,
				country:  country.trim() || null,
				size:     size || null,
				notes:    notes.trim() || null,
			};
			const record = company?.id
				? await pb.collection('companies').update(String(company.id), data)
				: await pb.collection('companies').create(data);
			toast.success(company?.id ? 'Empresa actualizada' : 'Empresa creada');
			onSave(record as unknown as Record<string, unknown>);
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al guardar');
		} finally { saving = false; }
	}
</script>

<div class="space-y-4">
	<FormField label="Nombre" required error={errors.name}>
		<Input bind:value={name} placeholder="Ej. Clínica Santa María" error={!!errors.name} />
	</FormField>

	<div class="grid grid-cols-2 gap-3">
		<FormField label="Industria">
			<Select bind:value={industry}>
				<option value="">Sin industria</option>
				<option value="technology">Tecnología</option>
				<option value="finance">Finanzas</option>
				<option value="healthcare">Salud</option>
				<option value="retail">Comercio</option>
				<option value="manufacturing">Manufactura</option>
				<option value="education">Educación</option>
				<option value="real_estate">Bienes Raíces</option>
				<option value="hospitality">Hostelería</option>
				<option value="consulting">Consultoría</option>
				<option value="other">Otro</option>
			</Select>
		</FormField>
		<FormField label="Tamaño">
			<Select bind:value={size}>
				<option value="">Sin definir</option>
				<option value="1-10">1–10</option>
				<option value="11-50">11–50</option>
				<option value="51-200">51–200</option>
				<option value="201-500">201–500</option>
				<option value="500+">500+</option>
			</Select>
		</FormField>
	</div>

	<FormField label="Sitio web">
		<Input type="url" bind:value={website} placeholder="https://empresa.com" />
	</FormField>

	<div class="grid grid-cols-2 gap-3">
		<FormField label="Ciudad">
			<Input bind:value={city} placeholder="Caracas" />
		</FormField>
		<FormField label="País">
			<Input bind:value={country} placeholder="Venezuela" />
		</FormField>
	</div>

	<FormField label="Notas">
		<Textarea bind:value={notes} placeholder="Información adicional…" rows={3} />
	</FormField>

	<div class="flex justify-end gap-2 pt-2">
		<Btn variant="secondary" onclick={onClose}>Cancelar</Btn>
		<Btn variant="primary" loading={saving} onclick={save}>
			{company?.id ? 'Guardar cambios' : 'Crear empresa'}
		</Btn>
	</div>
</div>
