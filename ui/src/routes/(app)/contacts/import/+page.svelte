<script lang="ts">
	import { goto } from '$app/navigation';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { Btn } from '$lib/ui';
	import { Upload, ArrowLeft, CheckCircle, AlertCircle, FileText } from 'lucide-svelte';

	// ── Types ───────────────────────────────────────────────────────────────────
	type Row = Record<string, string>;
	type FieldMap = { csv: string; crm: keyof ContactInput };
	interface ContactInput {
		name: string; email: string; phone: string;
		status: string; source: string; notes: string;
	}

	// ── CRM fields available for mapping ────────────────────────────────────────
	const CRM_FIELDS: { key: keyof ContactInput; label: string; required?: boolean }[] = [
		{ key: 'name',   label: 'NOMBRE',   required: true },
		{ key: 'email',  label: 'EMAIL' },
		{ key: 'phone',  label: 'TELÉFONO' },
		{ key: 'status', label: 'ESTADO' },
		{ key: 'source', label: 'FUENTE' },
		{ key: 'notes',  label: 'NOTAS' },
	];

	// ── State ────────────────────────────────────────────────────────────────────
	let step        = $state<'upload' | 'map' | 'preview' | 'done'>('upload');
	let fileName    = $state('');
	let rows        = $state<Row[]>([]);
	let headers     = $state<string[]>([]);
	let mapping     = $state<FieldMap[]>([]);
	let importing   = $state(false);
	let imported    = $state(0);
	let errors      = $state<string[]>([]);
	let isDragging  = $state(false);

	// ── CSV parser ───────────────────────────────────────────────────────────────
	function parseCSV(text: string): Row[] {
		const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
		if (lines.length < 2) return [];

		function splitLine(line: string): string[] {
			const fields: string[] = [];
			let cur = '';
			let inQuote = false;
			for (let i = 0; i < line.length; i++) {
				const c = line[i];
				if (c === '"') {
					if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
					else { inQuote = !inQuote; }
				} else if (c === ',' && !inQuote) {
					fields.push(cur.trim()); cur = '';
				} else {
					cur += c;
				}
			}
			fields.push(cur.trim());
			return fields;
		}

		const hdrs = splitLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
		return lines.slice(1)
			.filter(l => l.trim())
			.map(line => {
				const vals = splitLine(line);
				const row: Row = {};
				hdrs.forEach((h, i) => { row[h] = (vals[i] ?? '').replace(/^"|"$/g, '').trim(); });
				return row;
			})
			.filter(row => Object.values(row).some(v => v));
	}

	// ── VCF parser ───────────────────────────────────────────────────────────────
	function parseVCF(text: string): Row[] {
		const cards = text.split(/BEGIN:VCARD/i).slice(1);
		return cards.map(card => {
			const row: Row = {};
			const lines = card.split(/\r?\n/);
			for (const line of lines) {
				const [rawKey, ...rest] = line.split(':');
				const value = rest.join(':').trim();
				if (!value) continue;
				const key = rawKey.split(';')[0].toUpperCase();
				if (key === 'FN')    row['Name']  = value;
				if (key === 'EMAIL') row['Email'] = value;
				if (key === 'TEL')   row['Phone'] = value.replace(/\s+/g, '');
				if (key === 'ORG')   row['Company'] = value;
				if (key === 'NOTE')  row['Notes'] = value;
			}
			return row;
		}).filter(r => r['Name']);
	}

	// ── Auto-detect column mapping ────────────────────────────────────────────────
	function autoMap(hdrs: string[]): FieldMap[] {
		const patterns: Record<keyof ContactInput, RegExp> = {
			name:   /nombre|name|full.?name|display.?name/i,
			email:  /email|correo|e.?mail/i,
			phone:  /tel[eé]fono|phone|cel|mobile|m[oó]vil|whatsapp/i,
			status: /estado|status/i,
			source: /fuente|source|origen/i,
			notes:  /nota|note|comentario|observ/i,
		};
		const map: FieldMap[] = [];
		const used = new Set<string>();

		for (const [crmKey, pattern] of Object.entries(patterns) as [keyof ContactInput, RegExp][]) {
			const match = hdrs.find(h => pattern.test(h) && !used.has(h));
			if (match) { map.push({ csv: match, crm: crmKey }); used.add(match); }
		}
		// Google Contacts CSV has verbose column names like "Phone 1 - Value"
		if (!map.find(m => m.crm === 'phone')) {
			const phoneCol = hdrs.find(h => /phone.*value|value.*phone/i.test(h) && !used.has(h));
			if (phoneCol) { map.push({ csv: phoneCol, crm: 'phone' }); used.add(phoneCol); }
		}
		if (!map.find(m => m.crm === 'email')) {
			const emailCol = hdrs.find(h => /email.*value|value.*email/i.test(h) && !used.has(h));
			if (emailCol) { map.push({ csv: emailCol, crm: 'email' }); used.add(emailCol); }
		}
		return map;
	}

	// ── File handling ─────────────────────────────────────────────────────────────
	async function handleFile(file: File) {
		if (!file) return;
		fileName = file.name;
		const text = await file.text();

		if (file.name.toLowerCase().endsWith('.vcf') || text.includes('BEGIN:VCARD')) {
			rows = parseVCF(text);
			headers = ['Name', 'Email', 'Phone', 'Company', 'Notes'];
		} else {
			rows = parseCSV(text);
			headers = rows.length > 0 ? Object.keys(rows[0]) : [];
		}

		if (rows.length === 0) {
			toast.error('No se encontraron filas en el archivo');
			return;
		}

		mapping = autoMap(headers);
		step = 'map';
	}

	function onFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files?.[0]) handleFile(input.files[0]);
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		const file = e.dataTransfer?.files[0];
		if (file) handleFile(file);
	}

	// ── Mapping management ────────────────────────────────────────────────────────
	function getMappedCol(crm: keyof ContactInput): string {
		return mapping.find(m => m.crm === crm)?.csv ?? '';
	}
	function setMappedCol(crm: keyof ContactInput, csv: string) {
		mapping = mapping.filter(m => m.crm !== crm);
		if (csv) mapping = [...mapping, { csv, crm }];
	}

	// ── Preview rows ──────────────────────────────────────────────────────────────
	const previewRows = $derived(rows.slice(0, 5));

	function getVal(row: Row, crm: keyof ContactInput): string {
		const col = getMappedCol(crm);
		return col ? (row[col] ?? '') : '';
	}

	// ── Import ────────────────────────────────────────────────────────────────────
	async function runImport() {
		importing = true;
		errors = [];
		imported = 0;

		// Validate name mapping exists
		if (!getMappedCol('name')) {
			toast.error('El campo NOMBRE es obligatorio — mapéalo primero');
			importing = false;
			return;
		}

		const validStatuses = ['lead', 'prospect', 'customer', 'churned', 'inactive'];

		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			const name = getVal(row, 'name').trim();
			if (!name) continue;

			let status = getVal(row, 'status').toLowerCase().trim();
			if (!validStatuses.includes(status)) status = 'lead'; // default

			try {
				await pb.collection('contacts').create({
					name,
					email:  getVal(row, 'email').trim(),
					phone:  getVal(row, 'phone').trim(),
					status,
					source: getVal(row, 'source').trim() || 'import',
					notes:  getVal(row, 'notes').trim(),
				});
				imported++;
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : String(e);
				errors.push(`Fila ${i + 2}: ${name} — ${msg}`);
			}
		}

		step = 'done';
		importing = false;
	}
</script>

<!-- ════════════════════════════════════════════════════════════════════════ -->
<div class="flex-1 p-5 md:p-6 max-w-3xl">

	<!-- Header -->
	<div class="mb-6 flex items-center gap-4">
		<a href="/contacts" class="text-[#444] hover:text-white transition-colors">
			<ArrowLeft class="h-4 w-4" />
		</a>
		<div>
			<div class="mb-0.5 text-[9px] tracking-widest text-[#444] uppercase">CONTACTOS // IMPORTAR</div>
			<h1>Importar contactos</h1>
		</div>
	</div>

	<!-- ── Step 1: Upload ─────────────────────────────────────────────────── -->
	{#if step === 'upload'}
		<div class="mb-6 border border-[#1a1a1a] bg-[#090909] p-5">
			<div class="mb-4 text-[9px] tracking-widest text-[#555] uppercase">FORMATOS SOPORTADOS</div>
			<div class="grid grid-cols-2 gap-3 mb-6">
				{#each [
					{ label: 'Google Contacts CSV', desc: 'contacts.google.com → Exportar → Google CSV', icon: '☁' },
					{ label: 'VCF / vCard',          desc: 'Android → Contactos → Exportar .vcf',          icon: '📱' },
					{ label: 'CSV genérico',          desc: 'Cualquier CSV con columna Name/Nombre',         icon: '📄' },
					{ label: 'Excel exportado',       desc: 'Guardar como CSV desde Excel',                  icon: '🗂' },
				] as fmt}
					<div class="border border-[#1a1a1a] p-3">
						<div class="text-base mb-1">{fmt.icon}</div>
						<div class="text-[10px] text-white tracking-widest uppercase">{fmt.label}</div>
						<div class="text-[9px] text-[#555] mt-0.5 leading-relaxed">{fmt.desc}</div>
					</div>
				{/each}
			</div>

			<!-- Drop zone -->
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<label
				class="flex flex-col items-center justify-center gap-3 border-2 border-dashed
					px-6 py-12 cursor-pointer transition-colors
					{isDragging ? 'border-white bg-[#111]' : 'border-[#222] hover:border-[#444]'}"
				ondragover={(e) => { e.preventDefault(); isDragging = true; }}
				ondragleave={() => { isDragging = false; }}
				ondrop={onDrop}
			>
				<Upload class="h-8 w-8 text-[#444]" />
				<div class="text-center">
					<div class="text-[11px] text-white tracking-widest uppercase">SOLTAR ARCHIVO AQUÍ</div>
					<div class="mt-1 text-[9px] text-[#555] tracking-widest uppercase">o hacer clic para seleccionar</div>
					<div class="mt-2 text-[9px] text-[#444]">.csv · .vcf · .txt</div>
				</div>
				<input
					type="file"
					accept=".csv,.vcf,.txt"
					class="hidden"
					onchange={onFileInput}
				/>
			</label>
		</div>

		<div class="text-[9px] text-[#444] tracking-widest uppercase leading-relaxed space-y-1">
			<div>→ Los contactos importados se agregan como status "lead" por defecto</div>
			<div>→ La fuente se registra automáticamente como "import"</div>
			<div>→ No se crean duplicados automáticamente — revisar antes de importar</div>
		</div>

	<!-- ── Step 2: Map columns ────────────────────────────────────────────── -->
	{:else if step === 'map'}
		<div class="mb-4 border border-[#1a1a1a] bg-[#090909] p-5">
			<div class="flex items-center justify-between mb-4">
				<div>
					<div class="text-[9px] tracking-widest text-[#444] uppercase mb-0.5">ARCHIVO CARGADO</div>
					<div class="flex items-center gap-2">
						<FileText class="h-3.5 w-3.5 text-[#555]" />
						<span class="text-[11px] text-white">{fileName}</span>
						<span class="text-[9px] text-[#555]">— {rows.length} filas detectadas</span>
					</div>
				</div>
				<button
					onclick={() => { step = 'upload'; rows = []; headers = []; }}
					class="text-[9px] tracking-widest text-[#444] uppercase hover:text-white transition-colors"
				>CAMBIAR ARCHIVO</button>
			</div>
		</div>

		<div class="mb-4 border border-[#1a1a1a] bg-[#090909] p-5">
			<div class="mb-4 text-[9px] tracking-widest text-[#444] uppercase">MAPEO DE COLUMNAS</div>
			<div class="space-y-3">
				{#each CRM_FIELDS as field}
					<div class="flex items-center gap-4">
						<div class="w-28 text-[10px] tracking-widest text-white uppercase shrink-0">
							{field.label}
							{#if field.required}<span class="text-red-400 ml-1">*</span>{/if}
						</div>
						<div class="text-[#444] shrink-0">←</div>
						<select
							value={getMappedCol(field.key)}
							onchange={(e) => setMappedCol(field.key, (e.target as HTMLSelectElement).value)}
							class="flex-1 border border-[#222] bg-[#0a0a0a] px-3 py-2 text-[10px]
								tracking-wide text-white outline-none focus:border-white"
						>
							<option value="">— no mapear —</option>
							{#each headers as h}
								<option value={h}>{h}</option>
							{/each}
						</select>
					</div>
				{/each}
			</div>
		</div>

		<!-- Preview table -->
		<div class="mb-5 border border-[#1a1a1a] bg-[#090909] overflow-hidden">
			<div class="border-b border-[#1a1a1a] px-4 py-2 text-[9px] tracking-widest text-[#444] uppercase">
				VISTA PREVIA — primeras 5 filas
			</div>
			<div class="overflow-x-auto">
				<table class="w-full text-[10px]">
					<thead>
						<tr class="border-b border-[#1a1a1a]">
							{#each CRM_FIELDS.filter(f => getMappedCol(f.key)) as f}
								<th class="px-3 py-2 text-left text-[9px] tracking-widest text-[#555] uppercase">{f.label}</th>
							{/each}
						</tr>
					</thead>
					<tbody class="divide-y divide-[#1a1a1a]">
						{#each previewRows as row}
							<tr>
								{#each CRM_FIELDS.filter(f => getMappedCol(f.key)) as f}
									<td class="px-3 py-2 text-[#888] max-w-[150px] truncate">{getVal(row, f.key) || '—'}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<div class="flex items-center justify-between">
			<div class="text-[9px] text-[#444] tracking-widest uppercase">
				{rows.length} contactos listos para importar
			</div>
			<Btn
				variant="primary"
				onclick={() => { step = 'preview'; }}
				disabled={!getMappedCol('name')}
			>
				Continuar →
			</Btn>
		</div>

	<!-- ── Step 3: Confirm + Import ───────────────────────────────────────── -->
	{:else if step === 'preview'}
		<div class="mb-5 border border-[#1a1a1a] bg-[#090909] p-5">
			<div class="mb-4 text-[9px] tracking-widest text-[#444] uppercase">RESUMEN DE IMPORTACIÓN</div>
			<div class="grid grid-cols-3 gap-4">
				<div class="border border-[#1a1a1a] p-3">
					<div class="text-[9px] tracking-widest text-[#444] uppercase">FILAS</div>
					<div class="mt-1 text-xl font-bold text-white">{rows.length}</div>
				</div>
				<div class="border border-[#1a1a1a] p-3">
					<div class="text-[9px] tracking-widest text-[#444] uppercase">CAMPOS MAPEADOS</div>
					<div class="mt-1 text-xl font-bold text-white">{mapping.length}</div>
				</div>
				<div class="border border-[#1a1a1a] p-3">
					<div class="text-[9px] tracking-widest text-[#444] uppercase">STATUS DEFAULT</div>
					<div class="mt-1 text-xl font-bold text-white">LEAD</div>
				</div>
			</div>
		</div>

		<div class="mb-5 text-[9px] text-[#555] tracking-widest uppercase space-y-1">
			<div>→ Se crearán {rows.length} contactos en la colección contacts</div>
			<div>→ Fuente registrada como "import" para todos</div>
			<div>→ Esta operación no es reversible automáticamente</div>
		</div>

		<div class="flex items-center gap-3">
			<button
				onclick={() => { step = 'map'; }}
				class="text-[9px] tracking-widest text-[#444] uppercase hover:text-white transition-colors"
			>← VOLVER</button>
			<Btn variant="primary" onclick={runImport} loading={importing}>
				{importing ? `Importando ${imported}/${rows.length}…` : `Importar ${rows.length} contactos`}
			</Btn>
		</div>

	<!-- ── Step 4: Done ────────────────────────────────────────────────────── -->
	{:else if step === 'done'}
		<div class="border border-[#1a1a1a] bg-[#090909] p-6">
			<div class="mb-6 flex items-center gap-3">
				{#if errors.length === 0}
					<CheckCircle class="h-6 w-6 text-emerald-400 shrink-0" />
					<div>
						<div class="text-sm font-bold text-white tracking-widest uppercase">Importación completada</div>
						<div class="text-[10px] text-[#555] mt-0.5">{imported} contactos creados exitosamente</div>
					</div>
				{:else}
					<AlertCircle class="h-6 w-6 text-amber-400 shrink-0" />
					<div>
						<div class="text-sm font-bold text-white tracking-widest uppercase">Importación parcial</div>
						<div class="text-[10px] text-[#555] mt-0.5">{imported} creados · {errors.length} errores</div>
					</div>
				{/if}
			</div>

			{#if errors.length > 0}
				<div class="mb-5 border border-red-500/20 bg-red-950/10 p-3 max-h-40 overflow-y-auto">
					<div class="mb-2 text-[9px] tracking-widest text-red-400 uppercase">ERRORES</div>
					{#each errors as err}
						<div class="text-[9px] text-red-400/70 leading-relaxed">{err}</div>
					{/each}
				</div>
			{/if}

			<div class="flex gap-3">
				<Btn variant="primary" onclick={() => goto('/contacts')}>
					Ver contactos
				</Btn>
				<Btn variant="outline" onclick={() => { step = 'upload'; rows = []; errors = []; imported = 0; }}>
					Nueva importación
				</Btn>
			</div>
		</div>
	{/if}
</div>
