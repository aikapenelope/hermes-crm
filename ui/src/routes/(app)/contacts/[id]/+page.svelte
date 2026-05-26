<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { Sheet, Modal, Btn, Badge, Skeleton } from '$lib/ui';
	import ContactForm from '$lib/forms/ContactForm.svelte';
	import {
		ArrowLeft, Phone, Mail, Link, Send,
		Pencil, Trash2, MessageSquare, CheckSquare,
		DollarSign, Calendar, Activity, Paperclip,
	} from 'lucide-svelte';

	const contactId = $derived($page.params.id ?? '');

	type Contact = Record<string, unknown>;
	type Deal    = { id: string; title: string; value: number; currency: string; stage: string };
	type Task    = { id: string; title: string; type: string; status: string; priority: string; due_date: string; created: string };
	type Note    = { id: string; content: string; created: string; pinned?: boolean; attachments?: string[] };
	type Activity = { id: string; type: string; title?: string; description?: string; date?: string; created: string };

	// ── Timeline entry (merged) ──────────────────────────────────────────────
	type TimelineEntry =
		| { kind: 'note';     ts: string; data: Note     }
		| { kind: 'activity'; ts: string; data: Activity }
		| { kind: 'task';     ts: string; data: Task     }
		| { kind: 'deal';     ts: string; data: Deal     };

	let contact   = $state<Contact | null>(null);
	let deals     = $state<Deal[]>([]);
	let tasks     = $state<Task[]>([]);
	let notes     = $state<Note[]>([]);
	let activities = $state<Activity[]>([]);
	let loading   = $state(true);

	let editOpen   = $state(false);
	let deleteOpen = $state(false);
	let deleting   = $state(false);

	let noteContent  = $state('');
	let noteFiles    = $state<File[]>([]);
	let savingNote   = $state(false);

	// ── Realtime unsubscribe handles ─────────────────────────────────────────
	let unsubNotes: (() => void) | null = null;

	onMount(async () => {
		try {
			const [c, d, t, n, a] = await Promise.all([
				pb.collection('contacts').getOne(contactId, { expand: 'company,tags' }),
				pb.collection('deals').getList<Deal>(1, 20, {
					filter: `contact = '${contactId}'`,
					sort: '-created',
					fields: 'id,title,value,currency,stage',
				}),
				pb.collection('tasks').getList<Task>(1, 30, {
					filter: `contact = '${contactId}'`,
					sort: '-created',
					fields: 'id,title,status,priority,due_date',
				}),
				pb.collection('notes').getList<Note>(1, 50, {
					filter: `contact = '${contactId}'`,
					sort: '-pinned,-created',
				}),
				pb.collection('activities').getList<Activity>(1, 50, {
					filter: `contact = '${contactId}'`,
					sort: '-date,-created',
					fields: 'id,type,title,description,date,created',
				}),
			]);
			contact    = c as Contact;
			deals      = d.items;
			tasks      = t.items;
			notes      = n.items;
			activities = a.items;
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al cargar contacto');
		} finally { loading = false; }

		// Realtime: notes created by Hermes MCP appear instantly
		unsubNotes = await pb.collection('notes').subscribe('*', (e) => {
			const rec = e.record as unknown as Note & { contact?: string };
			if (rec.contact !== contactId) return;
			if (e.action === 'create') notes = [rec as Note, ...notes];
			if (e.action === 'delete') notes = notes.filter(n => n.id !== e.record.id);
		});
	});

	onDestroy(() => { unsubNotes?.(); });

	// ── Unified timeline (merge + sort) ──────────────────────────────────────
	const timeline = $derived((): TimelineEntry[] => {
		const entries: TimelineEntry[] = [
			...notes.map(n      => ({ kind: 'note'     as const, ts: n.created,           data: n })),
			...activities.map(a => ({ kind: 'activity' as const, ts: a.date || a.created,  data: a })),
			...tasks.map(t      => ({ kind: 'task'     as const, ts: t.created,            data: t })),
			...deals.map(d      => ({ kind: 'deal'     as const, ts: d.id ? d.id : '',     data: d })),
		];
		// Sort descending — newest first. Deal entries sorted by created via id alphabetically
		entries.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
		return entries;
	});

	async function refreshContact() {
		contact = await pb.collection('contacts').getOne(contactId, { expand: 'company,tags' }) as Contact;
	}

	async function handleDelete() {
		deleting = true;
		try {
			await pb.collection('contacts').delete(contactId);
			toast.success('Contacto eliminado');
			await goto('/contacts');
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al eliminar');
			deleting = false;
		}
	}

	async function addNote() {
		if (!noteContent.trim() && noteFiles.length === 0) return;
		savingNote = true;
		try {
			let rec: Note;
			if (noteFiles.length > 0) {
				// Use FormData for file uploads
				const fd = new FormData();
				fd.append('contact', contactId);
				fd.append('content', noteContent.trim());
				if (pb.authStore.record?.id) fd.append('created_by', pb.authStore.record.id);
				noteFiles.forEach(f => fd.append('attachments', f));
				rec = await pb.collection('notes').create<Note>(fd);
			} else {
				rec = await pb.collection('notes').create<Note>({
					contact: contactId,
					content: noteContent.trim(),
					created_by: pb.authStore.record?.id,
				});
			}
			if (!notes.find(n => n.id === rec.id)) notes = [rec, ...notes];
			noteContent = '';
			noteFiles = [];
			toast.success('Nota añadida');
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al guardar nota');
		} finally { savingNote = false; }
	}

	async function deleteNote(noteId: string) {
		try {
			await pb.collection('notes').delete(noteId);
			notes = notes.filter(n => n.id !== noteId);
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error');
		}
	}

	// ── Helpers ───────────────────────────────────────────────────────────────
	const stageColors: Record<string, 'slate' | 'blue' | 'amber' | 'orange' | 'green' | 'red'> = {
		lead: 'slate', qualified: 'blue', proposal: 'amber',
		negotiation: 'orange', won: 'green', lost: 'red',
	};
	const stageLabel: Record<string, string> = {
		lead: 'LEAD', qualified: 'CALIFICADO', proposal: 'PROPUESTA',
		negotiation: 'NEGOCIACIÓN', won: 'GANADO', lost: 'PERDIDO',
	};
	const priorityDot: Record<string, string> = {
		low: 'bg-[#444]', medium: 'bg-white', high: 'bg-amber-400', urgent: 'bg-rose-500',
	};
	const activityIcon: Record<string, string> = {
		call: '📞', email: '📧', meeting: '👥', demo: '💻',
		note: '📝', stage_change: '→', deal_created: '💰',
		task_done: '✓', contact_created: '👤',
	};

	function fmtTs(d: string) {
		if (!d) return '';
		const dt = new Date(d);
		const now = new Date();
		const diff = now.getTime() - dt.getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `${mins}m`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}h`;
		const days = Math.floor(hrs / 24);
		if (days < 7) return `${days}d`;
		return dt.toLocaleDateString('es', { day: '2-digit', month: 'short' });
	}
	function fmtDate(d: string) {
		if (!d) return '—';
		return new Date(d).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
	}
</script>

<svelte:head>
	<title>{contact ? String(contact.name ?? 'Contacto') : 'Contacto'} — Hermes CRM</title>
</svelte:head>

<div class="flex-1 p-5 md:p-6 uppercase tracking-widest" style="font-size:11px;">
	<!-- Header -->
	<div class="mb-5 flex items-center justify-between">
		<a href="/contacts" class="inline-flex items-center gap-1.5 text-[#555] hover:text-white transition-colors">
			<ArrowLeft class="h-3.5 w-3.5" />
			<span class="text-[9px]">CONTACTOS</span>
		</a>
		{#if contact && !loading}
			<div class="flex items-center gap-2">
				<Btn variant="outline" size="sm" onclick={() => { editOpen = true; }}>
					{#snippet icon()}<Pencil class="h-3 w-3" />{/snippet}
					Editar
				</Btn>
				<Btn variant="ghost" size="sm" onclick={() => { deleteOpen = true; }}>
					{#snippet icon()}<Trash2 class="h-3 w-3 text-red-400" />{/snippet}
					<span class="text-red-400">Eliminar</span>
				</Btn>
			</div>
		{/if}
	</div>

	{#if loading}
		<Skeleton rows={8} />
	{:else if contact}
		<div class="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">

			<!-- ══════════════════════════ LEFT COLUMN ══════════════════════ -->
			<div class="space-y-4">
				<!-- Contact card -->
				<div class="border border-[#1a1a1a] bg-[#090909] p-5">
					<!-- Initials -->
					<div class="mb-4 flex items-center gap-3">
						<div class="flex h-10 w-10 items-center justify-center border border-[#333]
							text-sm font-bold text-white bg-[#111]">
							{String(contact.name ?? contact.email ?? '?')[0].toUpperCase()}
						</div>
						<div class="min-w-0">
							<div class="font-bold text-white normal-case" style="font-size:14px; letter-spacing:-0.01em; font-family:system-ui;">
								{contact.name as string ?? '—'}
							</div>
							{#if contact.status}
								<Badge variant={stageColors[contact.status as string] ?? 'slate'} size="sm">
									{contact.status as string}
								</Badge>
							{/if}
						</div>
					</div>

					<!-- Contact info -->
					<ul class="space-y-2">
						{#if contact.email}
							<li class="flex items-center gap-2 text-[#888]">
								<Mail class="h-3 w-3 shrink-0 text-[#444]" />
								<a href="mailto:{contact.email}" class="hover:text-white transition-colors truncate normal-case">
									{contact.email as string}
								</a>
							</li>
						{/if}
						{#if contact.phone}
							<li class="flex items-center gap-2 text-[#888]">
								<Phone class="h-3 w-3 shrink-0 text-[#444]" />
								<a href="tel:{contact.phone}" class="hover:text-white transition-colors">
									{contact.phone as string}
								</a>
							</li>
						{/if}
						{#if contact.linkedin}
							<li class="flex items-center gap-2 text-[#888]">
								<Link class="h-3 w-3 shrink-0 text-[#444]" />
								<a href={contact.linkedin as string} target="_blank" class="hover:text-white transition-colors truncate">
									LinkedIn
								</a>
							</li>
						{/if}
					</ul>

					<!-- Tags -->
					{#if (contact.expand as Record<string,unknown>)?.tags}
						<div class="mt-3 flex flex-wrap gap-1">
							{#each (contact.expand as Record<string, { id: string; label: string; color?: string }[]>).tags as tag}
								<span class="border border-[#222] px-2 py-0.5 text-[8px] text-[#666] tracking-widest uppercase">
									{tag.label}
								</span>
							{/each}
						</div>
					{/if}

					{#if contact.notes}
						<div class="mt-3 border-t border-[#1a1a1a] pt-3 text-[10px] text-[#555] leading-relaxed normal-case">
							{contact.notes as string}
						</div>
					{/if}
				</div>

				<!-- Quick stats -->
				<div class="grid grid-cols-2 gap-2">
					<div class="border border-[#1a1a1a] bg-[#090909] p-3">
						<div class="text-[9px] text-[#444]">NEGOCIOS</div>
						<div class="mt-1 text-xl font-bold text-white" style="font-family:system-ui;">{deals.length}</div>
					</div>
					<div class="border border-[#1a1a1a] bg-[#090909] p-3">
						<div class="text-[9px] text-[#444]">TAREAS</div>
						<div class="mt-1 text-xl font-bold text-white" style="font-family:system-ui;">
							{tasks.filter(t => t.status !== 'done').length}
						</div>
					</div>
					<div class="border border-[#1a1a1a] bg-[#090909] p-3">
						<div class="text-[9px] text-[#444]">NOTAS</div>
						<div class="mt-1 text-xl font-bold text-white" style="font-family:system-ui;">{notes.length}</div>
					</div>
					<div class="border border-[#1a1a1a] bg-[#090909] p-3">
						<div class="text-[9px] text-[#444]">ACTIVIDADES</div>
						<div class="mt-1 text-xl font-bold text-white" style="font-family:system-ui;">{activities.length}</div>
					</div>
				</div>

				<!-- Open deals summary -->
				{#if deals.filter(d => !['won','lost'].includes(d.stage)).length > 0}
					<div class="border border-[#1a1a1a] bg-[#090909]">
						<div class="border-b border-[#1a1a1a] px-3 py-2 text-[9px] text-[#444]">PIPELINE ACTIVO</div>
						<ul class="divide-y divide-[#1a1a1a]">
							{#each deals.filter(d => !['won','lost'].includes(d.stage)) as d}
								<li class="flex items-center justify-between gap-2 px-3 py-2">
									<span class="truncate text-[10px] text-[#888] normal-case">{d.title}</span>
									<div class="flex items-center gap-1 shrink-0">
										{#if d.value}
											<span class="text-[9px] text-emerald-500">
												{d.currency} {d.value.toLocaleString('es', {maximumFractionDigits:0})}
											</span>
										{/if}
										<Badge variant={stageColors[d.stage] ?? 'slate'} size="sm">
											{stageLabel[d.stage] ?? d.stage}
										</Badge>
									</div>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>

			<!-- ═════════════════════════ RIGHT: TIMELINE ═══════════════════ -->
			<div class="flex flex-col gap-4">

				<!-- Quick note input -->
				<div class="border border-[#1a1a1a] bg-[#090909] p-4">
					<div class="mb-2 text-[9px] text-[#444]">AÑADIR NOTA</div>
					<div class="flex gap-2">
						<textarea
							bind:value={noteContent}
							placeholder="Escribe una nota sobre este contacto…"
							rows={2}
							class="flex-1 resize-none border border-[#222] bg-transparent px-3 py-2
								text-[11px] text-white normal-case tracking-normal
								placeholder-[#444] outline-none focus:border-white transition-colors"
							onkeydown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote(); }}
						></textarea>
						<Btn variant="primary" size="sm" loading={savingNote} onclick={addNote} disabled={!noteContent.trim() && noteFiles.length === 0}>
							{#snippet icon()}<Send class="h-3 w-3" />{/snippet}
							Añadir
						</Btn>
					</div>
					<!-- File attachment input -->
					<div class="mt-2 flex items-center gap-2">
						<label class="cursor-pointer border border-dashed border-[#222] px-3 py-1.5 text-[8px]
							tracking-widest text-[#444] uppercase hover:border-[#444] hover:text-[#888] transition-colors">
							<Paperclip class="inline h-2.5 w-2.5 mr-1" />
							ADJUNTAR
							<input
								type="file"
								multiple
								accept="image/*,application/pdf,text/plain"
								class="hidden"
								onchange={(e) => {
									const input = e.target as HTMLInputElement;
									noteFiles = input.files ? Array.from(input.files) : [];
								}}
							/>
						</label>
						{#if noteFiles.length > 0}
							<div class="flex flex-wrap gap-1">
								{#each noteFiles as f, i}
									<div class="flex items-center gap-1 border border-[#222] px-2 py-0.5">
										<span class="text-[8px] text-[#666] normal-case max-w-24 truncate">{f.name}</span>
										<button onclick={() => { noteFiles = noteFiles.filter((_, j) => j !== i); }}
											class="text-[#444] hover:text-red-400 transition-colors">✕</button>
									</div>
								{/each}
							</div>
						{/if}
					</div>
					<div class="mt-1 text-[8px] text-[#333]">Cmd/Ctrl+Enter para guardar rápido · Imágenes, PDF, texto</div>
				</div>

				<!-- Timeline feed -->
				<div class="border border-[#1a1a1a] bg-[#090909]">
					<div class="flex items-center justify-between border-b border-[#1a1a1a] px-4 py-2.5">
						<div class="text-[9px] text-[#444]">TIMELINE — {timeline().length} ENTRADAS</div>
						<div class="flex items-center gap-3 text-[8px] text-[#333]">
							<span class="flex items-center gap-1"><MessageSquare class="h-2.5 w-2.5"/>NOTA</span>
							<span class="flex items-center gap-1"><Activity class="h-2.5 w-2.5"/>ACTIVIDAD</span>
							<span class="flex items-center gap-1"><CheckSquare class="h-2.5 w-2.5"/>TAREA</span>
							<span class="flex items-center gap-1"><DollarSign class="h-2.5 w-2.5"/>DEAL</span>
						</div>
					</div>

					{#if timeline().length === 0}
						<div class="px-4 py-12 text-center text-[#333]">
							SIN_ACTIVIDAD — este contacto no tiene historial todavía
						</div>
					{:else}
						<div class="divide-y divide-[#111] max-h-[calc(100vh-320px)] overflow-y-auto">
							{#each timeline() as entry (entry.kind + '-' + entry.data.id)}
								<div class="group flex items-start gap-3 px-4 py-3 hover:bg-[#0d0d0d] transition-colors">

									<!-- Type indicator -->
									<div class="mt-0.5 shrink-0 w-6 text-center">
										{#if entry.kind === 'note'}
											<span class="text-xs text-[#555]">📝</span>
										{:else if entry.kind === 'activity'}
											<span class="text-xs">{activityIcon[entry.data.type] ?? '·'}</span>
										{:else if entry.kind === 'task'}
											<span class="text-xs {entry.data.status === 'done' ? 'text-emerald-500' : 'text-[#555]'}">
												{entry.data.status === 'done' ? '✓' : '○'}
											</span>
										{:else if entry.kind === 'deal'}
											<span class="text-xs text-emerald-500">💰</span>
										{/if}
									</div>

									<!-- Content -->
									<div class="flex-1 min-w-0">
										{#if entry.kind === 'note'}
											{@const note = entry.data as Note}
											<p class="normal-case text-[12px] text-[#aaa] leading-relaxed whitespace-pre-wrap" style="letter-spacing:0;">
												{note.content}
											</p>
											{#if note.pinned}
												<span class="mt-1 inline-block text-[8px] text-amber-500 tracking-widest uppercase">📌 FIJADA</span>
											{/if}

										{:else if entry.kind === 'activity'}
											{@const act = entry.data as Activity}
											<div class="text-[10px] font-bold text-white tracking-widest uppercase">
												{act.title || act.type?.toUpperCase() || 'ACTIVIDAD'}
											</div>
											{#if act.description}
												<p class="mt-0.5 normal-case text-[11px] text-[#666] leading-relaxed" style="letter-spacing:0;">
													{act.description}
												</p>
											{/if}
											{#if act.date}
												<div class="mt-1 text-[9px] text-[#444]">
													<Calendar class="inline h-2.5 w-2.5 mr-0.5" />
													{fmtDate(act.date)}
												</div>
											{/if}

										{:else if entry.kind === 'task'}
											{@const task = entry.data as Task}
											<div class="flex items-center gap-2">
												<div class="h-1.5 w-1.5 rounded-full shrink-0 {priorityDot[task.priority] ?? 'bg-[#444]'}"></div>
												<span class="normal-case text-[12px] {task.status === 'done' ? 'line-through text-[#444]' : 'text-white'}"
													style="letter-spacing:0;">
													{task.title}
												</span>
											</div>
											<div class="mt-0.5 flex items-center gap-2">
												<span class="text-[9px] text-[#444] uppercase tracking-widest">{task.type ?? ''}</span>
												{#if task.due_date}
													<span class="text-[9px] text-[#444]">{task.due_date.slice(0,10)}</span>
												{/if}
											</div>

										{:else if entry.kind === 'deal'}
											{@const deal = entry.data as Deal}
											<div class="flex items-center gap-2">
												<span class="normal-case text-[12px] text-white" style="letter-spacing:0;">{deal.title}</span>
												<Badge variant={stageColors[deal.stage] ?? 'slate'} size="sm">
													{stageLabel[deal.stage] ?? deal.stage}
												</Badge>
											</div>
											{#if deal.value}
												<div class="mt-0.5 text-[10px] font-bold text-emerald-500">
													{deal.currency} {deal.value.toLocaleString('es', {maximumFractionDigits:0})}
												</div>
											{/if}
										{/if}
									</div>

									<!-- Timestamp + actions -->
									<div class="shrink-0 flex items-center gap-2">
										<span class="text-[9px] text-[#444]">{fmtTs(entry.ts)}</span>
										{#if entry.kind === 'note'}
											<button
												onclick={() => deleteNote(entry.data.id)}
												class="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-[#444] hover:text-red-400"
											>
												<Trash2 class="h-2.5 w-2.5" />
											</button>
										{/if}
									</div>

								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<Sheet
	open={editOpen}
	title="Editar contacto"
	description="Modifica la información del contacto"
	onclose={() => { editOpen = false; }}
>
	{#snippet children()}
		<ContactForm
			contact={contact}
			onSave={() => { editOpen = false; refreshContact(); }}
			onClose={() => { editOpen = false; }}
		/>
	{/snippet}
</Sheet>

<Modal
	open={deleteOpen}
	title="Eliminar contacto"
	message="¿Eliminar a {String(contact?.name ?? 'este contacto')}? Esta acción no se puede deshacer."
	confirmLabel="Eliminar contacto"
	variant="danger"
	loading={deleting}
	onconfirm={handleDelete}
	oncancel={() => { deleteOpen = false; }}
/>
