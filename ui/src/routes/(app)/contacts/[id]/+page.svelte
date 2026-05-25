<script lang="ts">
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { ArrowLeft, Phone, Mail, Globe, MessageCircle } from 'lucide-svelte';
	import type { UnsubscribeFunc } from 'pocketbase';

	const contactId = $derived($page.params.id);

	type Contact = Record<string, unknown>;
	type Conversation = { id: string; contact: string; direction: string; channel: string; content: string; created: string };
	type Deal = { id: string; title: string; value: number; currency: string; stage: string };
	type Task = { id: string; title: string; status: string; priority: string; due_date: string };

	let contact = $state<Contact | null>(null);
	let conversations = $state<Conversation[]>([]);
	let deals = $state<Deal[]>([]);
	let tasks = $state<Task[]>([]);
	let loading = $state(true);

	let unsubConversations: UnsubscribeFunc | null = null;

	onMount(async () => {
		try {
			const [c, convs, d, t] = await Promise.all([
				pb.collection('contacts').getOne(contactId, { expand: 'company,tags' }),
				pb.collection('conversations').getList<Conversation>(1, 20, {
					filter: `contact = '${contactId}'`,
					sort: '-created',
				}),
				pb.collection('deals').getList<Deal>(1, 10, {
					filter: `contact = '${contactId}'`,
					sort: '-created',
					fields: 'id,title,value,currency,stage',
				}),
				pb.collection('tasks').getList<Task>(1, 10, {
					filter: `contact = '${contactId}'`,
					sort: 'due_date',
					fields: 'id,title,status,priority,due_date',
				}),
			]);
			contact = c as Contact;
			conversations = convs.items;
			deals = d.items;
			tasks = t.items;

			// Realtime: new conversations appear instantly
			unsubConversations = await pb.collection('conversations').subscribe('*', (e) => {
				const rec = e.record as unknown as Conversation;
				if (rec.contact === contactId) {
					if (e.action === 'create') {
						conversations = [rec, ...conversations].slice(0, 20);
					}
				}
			});
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al cargar contacto');
		} finally {
			loading = false;
		}
	});

	onDestroy(() => {
		unsubConversations?.();
	});

	const stageColors: Record<string, string> = {
		lead: 'bg-slate-700 text-slate-300',
		qualified: 'bg-blue-900/50 text-blue-300',
		proposal: 'bg-amber-900/50 text-amber-300',
		negotiation: 'bg-orange-900/50 text-orange-300',
		won: 'bg-emerald-900/50 text-emerald-300',
		lost: 'bg-rose-900/50 text-rose-300',
	};

	const channelIcons: Record<string, string> = {
		whatsapp: '💬', telegram: '✈️', email: '📧', web: '🌐',
	};
</script>

<svelte:head>
	<title>{contact ? String(contact.name ?? 'Contacto') : 'Contacto'} — Hermes CRM</title>
</svelte:head>

<div class="flex-1 p-6">
	<a href="/contacts" class="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
		<ArrowLeft class="h-4 w-4" /> Contactos
	</a>

	{#if loading}
		<div class="flex items-center gap-2 mt-4 text-sm text-slate-400">
			<div class="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500"></div>
			Cargando…
		</div>
	{:else if contact}
		<div class="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-3">
			<!-- Left: contact info -->
			<div class="space-y-4">
				<div class="rounded-xl border border-slate-800 bg-slate-900 p-5">
					<!-- Avatar + name -->
					<div class="mb-4 flex items-center gap-3">
						<div class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 text-lg font-semibold text-slate-300">
							{String(contact.name ?? contact.email ?? '?')[0].toUpperCase()}
						</div>
						<div>
							<h1 class="text-base font-semibold text-slate-100">{contact.name as string ?? '—'}</h1>
							{#if contact.status}
								<span class="text-xs text-slate-400">{contact.status as string}</span>
							{/if}
						</div>
					</div>
					<!-- Details -->
					<ul class="space-y-2 text-sm">
						{#if contact.email}
							<li class="flex items-center gap-2 text-slate-300">
								<Mail class="h-4 w-4 shrink-0 text-slate-500" />
								<a href="mailto:{contact.email}" class="hover:text-blue-400 truncate">{contact.email as string}</a>
							</li>
						{/if}
						{#if contact.phone}
							<li class="flex items-center gap-2 text-slate-300">
								<Phone class="h-4 w-4 shrink-0 text-slate-500" />
								<span>{contact.phone as string}</span>
							</li>
						{/if}
						{#if contact.linkedin}
							<li class="flex items-center gap-2 text-slate-300">
								<Globe class="h-4 w-4 shrink-0 text-slate-500" />
								<a href={contact.linkedin as string} target="_blank" class="hover:text-blue-400 truncate">LinkedIn</a>
							</li>
						{/if}
					</ul>
					{#if contact.notes}
						<p class="mt-4 text-xs text-slate-400 border-t border-slate-800 pt-3">{contact.notes as string}</p>
					{/if}
				</div>

				<!-- Deals -->
				<div class="rounded-xl border border-slate-800 bg-slate-900">
					<div class="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
						<h2 class="text-sm font-semibold text-slate-200">Negocios ({deals.length})</h2>
						<a href="/deals" class="text-xs text-blue-400 hover:text-blue-300">Ver todos</a>
					</div>
					{#if deals.length === 0}
						<p class="px-4 py-4 text-xs text-slate-500">Sin negocios</p>
					{:else}
						<ul class="divide-y divide-slate-800">
							{#each deals as d (d.id)}
								<li class="px-4 py-2.5">
									<a href="/deals" class="flex items-center justify-between gap-2 hover:text-blue-400">
										<span class="truncate text-sm text-slate-200">{d.title}</span>
										<div class="flex items-center gap-1.5 shrink-0">
											<span class="text-xs font-medium text-emerald-400">
												{d.currency} {d.value?.toLocaleString() ?? 0}
											</span>
											<span class="rounded px-1 py-0.5 text-xs {stageColors[d.stage] ?? 'bg-slate-700 text-slate-400'}">
												{d.stage}
											</span>
										</div>
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</div>

				<!-- Tasks -->
				<div class="rounded-xl border border-slate-800 bg-slate-900">
					<h2 class="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-slate-200">
						Tareas ({tasks.length})
					</h2>
					{#if tasks.length === 0}
						<p class="px-4 py-4 text-xs text-slate-500">Sin tareas</p>
					{:else}
						<ul class="divide-y divide-slate-800">
							{#each tasks as t (t.id)}
								<li class="flex items-center gap-2 px-4 py-2.5">
									<span class="h-1.5 w-1.5 shrink-0 rounded-full {t.status === 'done' ? 'bg-emerald-500' : t.priority === 'urgent' ? 'bg-rose-500' : 'bg-slate-500'}"></span>
									<span class="flex-1 truncate text-sm {t.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-300'}">{t.title}</span>
									{#if t.due_date}
										<span class="shrink-0 text-xs text-slate-500">{t.due_date.slice(0, 10)}</span>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>

			<!-- Right: conversation log -->
			<div class="lg:col-span-2">
				<div class="rounded-xl border border-slate-800 bg-slate-900 h-full flex flex-col">
					<div class="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
						<MessageCircle class="h-4 w-4 text-slate-400" />
						<h2 class="text-sm font-semibold text-slate-200">Conversaciones</h2>
						<span class="ml-auto text-xs text-slate-500">{conversations.length} mensajes</span>
					</div>
					{#if conversations.length === 0}
						<div class="flex flex-1 items-center justify-center p-8 text-sm text-slate-500">
							Sin mensajes aún — Hermes los registrará automáticamente
						</div>
					{:else}
						<ul class="flex-1 overflow-y-auto divide-y divide-slate-800">
							{#each conversations as conv (conv.id)}
								<li class="px-4 py-3">
									<div class="mb-1 flex items-center gap-2">
										<span class="text-sm">{channelIcons[conv.channel] ?? '💬'}</span>
										<span class="text-xs font-medium {conv.direction === 'inbound' ? 'text-blue-400' : 'text-emerald-400'}">
											{conv.direction === 'inbound' ? 'Entrante' : 'Saliente'}
										</span>
										<span class="ml-auto text-xs text-slate-500">
											{new Date(conv.created).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
										</span>
									</div>
									<p class="text-sm text-slate-300 whitespace-pre-wrap">{conv.content}</p>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
