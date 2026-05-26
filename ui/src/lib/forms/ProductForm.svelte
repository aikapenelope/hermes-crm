<script lang="ts">
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { FormField, Input, Select, Textarea, Btn } from '$lib/ui';

	interface Props {
		product?: Record<string, unknown> | null;
		onSave: (record: Record<string, unknown>) => void;
		onClose: () => void;
	}

	let { product = null, onSave, onClose }: Props = $props();

	let name        = $state('');
	let sku         = $state('');
	let type        = $state('product');
	let description = $state('');
	let price       = $state('');
	let currency    = $state('USD');
	let active      = $state(true);

	$effect(() => {
		name        = String(product?.name        ?? '');
		sku         = String(product?.sku         ?? '');
		type        = String(product?.type        ?? 'product');
		description = String(product?.description ?? '');
		price       = product?.price != null ? String(product.price) : '';
		currency    = String(product?.currency    ?? 'USD');
		active      = product?.active !== undefined ? Boolean(product.active) : true;
	});

	let errors = $state<Record<string, string>>({});
	let saving = $state(false);

	function validate(): boolean {
		const e: Record<string, string> = {};
		if (!name.trim()) e.name = 'El nombre es requerido';
		if (price && isNaN(Number(price))) e.price = 'Debe ser un número';
		errors = e;
		return Object.keys(e).length === 0;
	}

	async function save() {
		if (!validate()) return;
		saving = true;
		try {
			const data = {
				name:        name.trim(),
				sku:         sku.trim() || null,
				type:        type || null,
				description: description.trim() || null,
				price:       price ? Number(price) : null,
				currency:    currency || null,
				active,
			};
			const record = product?.id
				? await pb.collection('products').update(String(product.id), data)
				: await pb.collection('products').create(data);
			toast.success(product?.id ? 'Producto actualizado' : 'Producto creado');
			onSave(record as unknown as Record<string, unknown>);
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al guardar');
		} finally { saving = false; }
	}
</script>

<div class="space-y-4">
	<FormField label="Nombre" required error={errors.name}>
		<Input bind:value={name} placeholder="Ej. Plan Aurora Pro" error={!!errors.name} />
	</FormField>

	<div class="grid grid-cols-2 gap-3">
		<FormField label="SKU">
			<Input bind:value={sku} placeholder="AURORA-PRO-01" />
		</FormField>
		<FormField label="Tipo">
			<Select bind:value={type}>
				<option value="product">Producto</option>
				<option value="service">Servicio</option>
				<option value="subscription">Suscripción</option>
				<option value="license">Licencia</option>
			</Select>
		</FormField>
	</div>

	<div class="grid grid-cols-2 gap-3">
		<FormField label="Precio" error={errors.price}>
			<Input type="number" bind:value={price} placeholder="0" min="0" error={!!errors.price} />
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

	<FormField label="Descripción">
		<Textarea bind:value={description} placeholder="Descripción del producto o servicio…" rows={3} />
	</FormField>

	<label class="flex items-center gap-3 cursor-pointer">
		<input type="checkbox" bind:checked={active} class="rounded border-slate-600" />
		<span class="text-sm text-slate-300">Producto activo (visible en catálogo)</span>
	</label>

	<div class="flex justify-end gap-2 pt-2">
		<Btn variant="secondary" onclick={onClose}>Cancelar</Btn>
		<Btn variant="primary" loading={saving} onclick={save}>
			{product?.id ? 'Guardar cambios' : 'Crear producto'}
		</Btn>
	</div>
</div>
