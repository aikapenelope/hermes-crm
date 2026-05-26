<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { Sheet, Modal, Btn, Badge, Skeleton } from '$lib/ui';
	import ContactForm from '$lib/forms/ContactForm.svelte';
	import {
		ArrowLeft, Phone, Mail,
		Link, Send, Pencil, Trash2,
	} from 'lucide-svelte';

	const contactId = $derived($page.params.id ?? '');

	type Contact = Record<string, unknown>;
	type Deal = { id: string; title: string; value: number; currency: string; stage: string };
	type Task = { id: string; title: string; status: string; priority: string; due_date: string };
	type Note = { id: string; content: string; created: string; expand?: { created_by?: { name: string } } };

	let contact = $state<Contact | null>(null);
	let deals   = $state<Deal[]>([]);
	let tasks   = $state<Task[]>([]);
	let notes   = $state<Note[]>([]);
	let loading = $state(true);

	let editOpen   = $state(false);
	let deleteOpen = $state(false);
	let deleting   = $state(false);

	let noteContent = $state('');
	let savingNote  = $state(false);

	onMount(async () => {
		try {
			const [c, d, t, n] = await Promise.all([
				pb.collection('contacts').getOne(contactId, { expand: 'company' }),
				pb.collection('deals').getList<Deal>(1, 10, {
					filter: `contact = '${contactId}'`,
					sort: '-created',
					fields: 'id,title,value,currency,stage',
				}),
				pb.collection('tasks').getList<Task>(1, 10, {
					filter: `contact = '${contactId}' && status != 'done'`,
					sort: 'due_date',
					fields: 'id,title,status,priority,due_date',
				}),
				pb.collection('notes').getList<Note>(1, 20, {
					filter: `contact = '${contactId}'`,
					sort: '-pinned,-created',
					expand: 'created_by',
				}),
			]);
			contact = c as Contact;
			deals   = d.items;
			tasks   = t.items;
			notes   = n.items;
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al cargar contacto');
		} finally { loading = false; }
	});

	async function refreshContact() {
		contact = await pb.collection('contacts').getOne(contactId, { expand: 'company' }) as Contact;
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
		if (!noteContent.trim()) return;
		savingNote = true;
		try {
			const rec = await pb.collection('notes').create<Note>({
				contact: contactId,
				content: noteContent.trim(),
				created_by: pb.authStore.record?.id,
			});
			notes = [rec, ...notes];
			noteContent = '';
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

	const stageColors: Record<string, 'slate' | 'blue' | 'amber' | 'orange' | 'green' | 'red'> = {
		lead: 'slate', qualified: 'blue', proposal: 'amber',
		negotiation: 'orange', won: 'green', lost: 'red',
	};
	const stageLabel: Record<string, string> = {
		lead: 'Lead', qualified: 'Calificado', proposal: 'Propuesta',
		negotiation: 'Negociación', won: 'Ganado', lost: 'Perdido',
	};
	const priorityColor: Record<string, string> = {
		low: 'text-slate-400', medium: 'text-white',
		high: 'text-amber-400', urgent: 'text-rose-400',
	};

	function formatDate(d: string) {
		return new Date(d).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
	}
</script>

<svelte:head>
	<title>{contact ? String(contact.name ?? 'Contacto') : 'Contacto'} — Hermes CRM</title>
</svelte:head>

<div class="flex-1 p-5 md:p-6">
	<div class="mb-5 flex items-center justify-between">
		<a href="/contacts" class="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors">
			<ArrowLeft class="h-4 w-4" /> Contactos
		</a>
		{#if contact && !loading}
			<div class="flex items-center gap-2">
				<Btn variant="secondary" size="sm" onclick={() => { editOpen = true; }}>
					{#snippet icon()}<Pencil class="h-3.5 w-3.5" />{/snippet}
					Editar
				</Btn>
				<Btn variant="ghost" size="sm" onclick={() => { deleteOpen = true; }}>
					{#snippet icon()}<Trash2 class="h-3.5 w-3.5 text-red-400" />{/snippet}
					<span class="text-red-400">Eliminar</span>
				</Btn>
			</div>
		{/if}
	</div>

	{#if loading}
		<Skeleton rows={8} />
	{:else if contact}
		<div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
			<!-- ── Left column: info + deals + tasks ─────────────────── -->
			<div class="space-y-4">
				<div class="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-5">
					<div class="mb-4 flex items-center gap-3">
						<div class="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#1a1a1a] to-[#111] text-lg font-bold text-slate-200">
							{String(contact.name ?? contact.email ?? '?')[0].toUpperCase()}
						</div>
						<div>
							<h1 class="text-lg font-semibold text-slate-50">{contact.name as string ?? '—'}</h1>
							{#if contact.status}
								<Badge variant={stageColors[contact.status as string] ?? 'slate'} size="sm">
									{contact.status as string}
								</Badge>
							{/if}
						</div>
					</div>
					<ul class="space-y-2.5 text-sm">
						{#if contact.email}
							<li class="flex items-center gap-2.5 text-slate-300">
								<Mail class="h-4 w-4 shrink-0 text-slate-500" />
								<a href="mailto:{contact.email}" class="hover:text-white truncate">{contact.email as string}</a>
							</li>
						{/if}
						{#if contact.phone}
							<li class="flex items-center gap-2.5 text-slate-300">
								<Phone class="h-4 w-4 shrink-0 text-slate-500" />
								<span>{contact.phone as string}</span>
							</li>
						{/if}
						{#if contact.linkedin}
							<li class="flex items-center gap-2.5 text-slate-300">
								<Link class="h-4 w-4 shrink-0 text-slate-500" />
								<a href={contact.linkedin as string} target="_blank" class="hover:text-white truncate">LinkedIn</a>
							</li>
						{/if}
					</ul>
					{#if contact.notes}
						<div class="mt-4 rounded-lg bg-slate-800/50 px-3 py-2.5">
							<p class="text-xs text-slate-400 leading-relaxed">{contact.notes as string}</p>
						</div>
					{/if}
				</div>

				<div class="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a]">
					<div class="flex items-center justify-between border-b border-[#1a1a1a] px-4 py-3">
						<h2 class="text-sm font-semibold text-slate-200">Negocios ({deals.length})</h2>
						<a href="/deals" class="text-[9px] tracking-widest text-[#555] uppercase hover:text-white transition-colors">VER TODOS</a>
					</div>
					{#if deals.length === 0}
						<p class="px-4 py-4 text-xs text-slate-500">Sin negocios asociados</p>
					{:else}
						<ul class="divide-y divide-[#1a1a1a]">
							{#each deals as d (d.id)}
								<li class="flex items-center justify-between gap-2 px-4 py-2.5">
									<span class="truncate text-sm text-slate-200">{d.title}</span>
									<div class="flex shrink-0 items-center gap-1.5">
										<span class="text-xs font-medium text-emerald-400">
											{d.currency} {(d.value ?? 0).toLocaleString()}
										</span>
										<Badge variant={stageColors[d.stage] ?? 'slate'} size="sm">
											{stageLabel[d.stage] ?? d.stage}
										</Badge>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</div>

				<div class="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a]">
					<h2 class="border-b border-[#1a1a1a] px-4 py-3 text-sm font-semibold text-slate-200">
						Tareas pendientes ({tasks.length})
					</h2>
					{#if tasks.length === 0}
						<p class="px-4 py-4 text-xs text-slate-500">Sin tareas</p>
					{:else}
						<ul class="divide-y divide-[#1a1a1a]">
							{#each tasks as t (t.id)}
								<li class="flex items-center gap-2 px-4 py-2.5">
									<span class="h-1.5 w-1.5 shrink-0 rounded-full {priorityColor[t.priority] ?? 'bg-slate-500'} bg-current"></span>
									<span class="flex-1 truncate text-sm text-slate-300">{t.title}</span>
									{#if t.due_date}
										<span class="shrink-0 text-xs text-slate-500">{t.due_date.slice(0, 10)}</span>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>

			<!-- ── Right column: notes ────────────────────────────────── -->
			<div class="lg:col-span-2">
				<div class="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a]">
					<h2 class="border-b border-[#1a1a1a] px-4 py-3 text-sm font-semibold text-slate-200">
						Notas ({notes.length})
					</h2>
					<div class="flex gap-2 border-b border-[#1a1a1a] p-3">
						<textarea
							bind:value={noteContent}
							placeholder="Añade una nota sobre este contacto…"
							rows={2}
							class="flex-1 resize-none rounded-lg border border-slate-700 bg-[#0d0d0d] px-3 py-2
								text-sm text-white placeholder-[#444] outline-none focus:border-white focus:ring-0"
							onkeydown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote(); }}
						></textarea>
						<Btn variant="primary" size="sm" loading={savingNote} onclick={addNote} disabled={!noteContent.trim()}>
							{#snippet icon()}<Send class="h-3.5 w-3.5" />{/snippet}
							Añadir
						</Btn>
					</div>
					{#if notes.length === 0}
						<p class="px-4 py-4 text-xs text-slate-500">Sin notas — añade contexto sobre este contacto</p>
					{:else}
						<ul class="divide-y divide-[#1a1a1a] max-h-[32rem] overflow-y-auto">
							{#each notes as note (note.id)}
								<li class="group flex items-start gap-2 px-4 py-3">
									<p class="flex-1 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{note.content}</p>
									<div class="flex shrink-0 items-center gap-2">
										<span class="text-xs text-slate-600">{formatDate(note.created)}</span>
										<button
											onclick={() => deleteNote(note.id)}
											class="rounded p-0.5 text-slate-600 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
										>
											<Trash2 class="h-3 w-3" />
										</button>
									</div>
								</li>
							{/each}
						</ul>
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
