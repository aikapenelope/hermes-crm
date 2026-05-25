<script lang="ts">
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { FormField, Input, Select, Textarea, Btn } from '$lib/ui';

	interface Props {
		contact?: Record<string, unknown> | null;
		onSave: (record: Record<string, unknown>) => void;
		onClose: () => void;
	}

	let { contact = null, onSave, onClose }: Props = $props();

	// Form state — initialised via $effect so they react when `contact` prop changes
	let name     = $state('');
	let email    = $state('');
	let phone    = $state('');
	let status   = $state('');
	let source   = $state('');
	let company  = $state('');
	let linkedin = $state('');
	let notes    = $state('');

	$effect(() => {
		name     = String(contact?.name     ?? '');
		email    = String(contact?.email    ?? '');
		phone    = String(contact?.phone    ?? '');
		status   = String(contact?.status   ?? '');
		source   = String(contact?.source   ?? '');
		company  = String(contact?.company  ?? '');
		linkedin = String(contact?.linkedin ?? '');
		notes    = String(contact?.notes    ?? '');
	});

	let errors     = $state<Record<string, string>>({});
	let saving     = $state(false);

	// Companies for select
	let companies  = $state<{ id: string; name: string }[]>([]);
	onMount(async () => {
		try {
			companies = await pb.collection('companies').getFullList<{ id: string; name: string }>({
				fields: 'id,name', sort: 'name',
			});
		} catch { /* non-critical */ }
	});

	function validate(): boolean {
		const e: Record<string, string> = {};
		if (!name.trim()) e.name = 'El nombre es requerido';
		if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Email inválido';
		errors = e;
		return Object.keys(e).length === 0;
	}

	async function save() {
		if (!validate()) return;
		saving = true;
		try {
			const data = {
				name: name.trim(),
				email: email.trim() || null,
				phone: phone.trim() || null,
				status: status || null,
				source: source || null,
				company: company || null,
				linkedin: linkedin.trim() || null,
				notes: notes.trim() || null,
			};
			const record = contact?.id
				? await pb.collection('contacts').update(String(contact.id), data)
				: await pb.collection('contacts').create(data);
			toast.success(contact?.id ? 'Contacto actualizado' : 'Contacto creado');
			onSave(record as unknown as Record<string, unknown>);
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al guardar');
		} finally {
			saving = false;
		}
	}
</script>

<div class="space-y-4">
	<FormField label="Nombre" required error={errors.name}>
		<Input bind:value={name} placeholder="Ej. María González" error={!!errors.name} />
	</FormField>

	<div class="grid grid-cols-2 gap-3">
		<FormField label="Email" error={errors.email}>
			<Input type="email" bind:value={email} placeholder="maria@email.com" error={!!errors.email} />
		</FormField>
		<FormField label="Teléfono">
			<Input bind:value={phone} placeholder="+58 414 000 0000" />
		</FormField>
	</div>

	<div class="grid grid-cols-2 gap-3">
		<FormField label="Estado">
			<Select bind:value={status}>
				<option value="">Sin estado</option>
				<option value="lead">Lead</option>
				<option value="prospect">Prospect</option>
				<option value="customer">Cliente</option>
				<option value="churned">Perdido</option>
				<option value="inactive">Inactivo</option>
			</Select>
		</FormField>
		<FormField label="Fuente">
			<Select bind:value={source}>
				<option value="">Sin fuente</option>
				<option value="whatsapp">WhatsApp</option>
				<option value="instagram">Instagram</option>
				<option value="web">Web</option>
				<option value="referral">Referido</option>
				<option value="email">Email</option>
				<option value="manual">Manual</option>
				<option value="other">Otro</option>
			</Select>
		</FormField>
	</div>

	<FormField label="Empresa">
		<Select bind:value={company}>
			<option value="">Sin empresa</option>
			{#each companies as c}
				<option value={c.id}>{c.name}</option>
			{/each}
		</Select>
	</FormField>

	<FormField label="LinkedIn">
		<Input bind:value={linkedin} placeholder="https://linkedin.com/in/..." type="url" />
	</FormField>

	<FormField label="Notas">
		<Textarea bind:value={notes} placeholder="Notas sobre este contacto…" rows={3} />
	</FormField>

	<!-- Actions -->
	<div class="flex justify-end gap-2 pt-2">
		<Btn variant="secondary" onclick={onClose}>Cancelar</Btn>
		<Btn variant="primary" loading={saving} onclick={save}>
			{contact?.id ? 'Guardar cambios' : 'Crear contacto'}
		</Btn>
	</div>
</div>
