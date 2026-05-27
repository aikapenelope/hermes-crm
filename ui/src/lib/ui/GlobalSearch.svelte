<script lang="ts">
	import { onDestroy } from 'svelte';
	import pb from '$lib/pb';
	import { sanitizeSearch } from '$lib/utils';
	import { Search, X } from 'lucide-svelte';

	// ── State ─────────────────────────────────────────────────────────────────
	let query   = $state('');
	let results = $state<{
		contacts: { id: string; name: string; email: string; status: string }[];
		companies: { id: string; name: string; industry: string }[];
		deals:    { id: string; title: string; stage: string; value: number; currency: string }[];
		tasks:    { id: string; title: string; status: string; priority: string }[];
	} | null>(null);
	let loading = $state(false);
	let open    = $state(false);

	let timer: ReturnType<typeof setTimeout>;
	onDestroy(() => clearTimeout(timer));

	// ── Search with 300ms debounce ─────────────────────────────────────────────
	async function onInput() {
		clearTimeout(timer);
		const q = query.trim();
		if (q.length < 2) { results = null; open = false; return; }

		open = true;
		loading = true;
		timer = setTimeout(async () => {
			try {
				const esc = sanitizeSearch(q);
				const [contacts, companies, deals, tasks] = await Promise.all([
					pb.collection('contacts').getList<{ id: string; name: string; email: string; status: string }>(1, 5, {
						filter: `name~'${esc}' || email~'${esc}' || phone~'${esc}'`,
						fields: 'id,name,email,status',
					}),
					pb.collection('companies').getList<{ id: string; name: string; industry: string }>(1, 3, {
						filter: `name~'${esc}'`,
						fields: 'id,name,industry',
					}),
					pb.collection('deals').getList<{ id: string; title: string; stage: string; value: number; currency: string }>(1, 4, {
						filter: `title~'${esc}'`,
						fields: 'id,title,stage,value,currency',
					}),
					pb.collection('tasks').getList<{ id: string; title: string; status: string; priority: string }>(1, 3, {
						filter: `title~'${esc}'`,
						fields: 'id,title,status,priority',
					}),
				]);
				results = {
					contacts: contacts.items,
					companies: companies.items,
					deals: deals.items,
					tasks: tasks.items,
				};
			} catch { results = null; }
			finally { loading = false; }
		}, 300);
	}

	function clear() {
		query = '';
		results = null;
		open = false;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') clear();
	}

	// ── Helpers ────────────────────────────────────────────────────────────────
	const total = $derived(results
		? results.contacts.length + results.companies.length + results.deals.length + results.tasks.length
		: 0
	);

	const stageLabel: Record<string, string> = {
		lead: 'LEAD', qualified: 'CALIF', proposal: 'PROP',
		negotiation: 'NEG', won: 'GANADO', lost: 'PERDIDO',
	};
</script>

<!-- Global search container -->
<div class="relative flex-1" style="max-width:440px;">
	<!-- Input -->
	<div class="relative flex items-center">
		<Search class="pointer-events-none absolute left-3 h-3 w-3 text-[#444]" />
		<input
			type="search"
			bind:value={query}
			oninput={onInput}
			onkeydown={onKeydown}
			onfocus={() => { if (query.trim().length >= 2) open = true; }}
			placeholder="BUSCAR [CONTACTOS / NEGOCIOS / TAREAS]"
			autocomplete="off"
			class="w-full border border-[#1a1a1a] bg-transparent py-2 pl-8 pr-8
				text-[10px] tracking-widest text-[#888] uppercase
				placeholder-[#333] outline-none focus:border-[#333] transition-colors"
		/>
		{#if query}
			<button onclick={clear} class="absolute right-2 text-[#444] hover:text-white transition-colors">
				<X class="h-3 w-3" />
			</button>
		{/if}
	</div>

	<!-- Dropdown -->
	{#if open}
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="fixed inset-0 z-40" onclick={clear} role="presentation"></div>

		<div class="absolute left-0 right-0 top-full z-50 mt-1 border border-[#1a1a1a] bg-[#080808] shadow-2xl">
			<!-- Top accent -->
			<div class="h-[1px]" style="background:linear-gradient(to right,#ff3333,#ffaa00,#00ffaa,#00aaff,#aa00ff);"></div>

			{#if loading}
				<div class="flex items-center gap-2 px-4 py-3 text-[9px] text-[#444] uppercase tracking-widest">
					<div class="h-2 w-2 animate-spin rounded-full border border-[#333] border-t-white"></div>
					BUSCANDO…
				</div>
			{:else if total === 0}
				<div class="px-4 py-3 text-[9px] text-[#333] uppercase tracking-widest">
					SIN RESULTADOS PARA "{query}"
				</div>
			{:else}
				<div class="max-h-80 overflow-y-auto">

					<!-- Contacts -->
					{#if results && results.contacts.length > 0}
						<div class="border-b border-[#111] px-3 py-1.5 text-[8px] text-[#333] tracking-widest uppercase">
							CONTACTOS
						</div>
						{#each results.contacts as c}
							<a
								href="/contacts/{c.id}"
								onclick={clear}
								class="flex items-center justify-between px-4 py-2.5 hover:bg-[#111] transition-colors"
							>
								<div>
									<div class="text-[11px] text-white normal-case" style="letter-spacing:0;">{c.name}</div>
									{#if c.email}
										<div class="text-[9px] text-[#555] normal-case">{c.email}</div>
									{/if}
								</div>
								<span class="text-[8px] text-[#444] uppercase tracking-widest">{c.status || 'lead'}</span>
							</a>
						{/each}
					{/if}

					<!-- Companies -->
					{#if results && results.companies.length > 0}
						<div class="border-b border-[#111] border-t border-t-[#111] px-3 py-1.5 text-[8px] text-[#333] tracking-widest uppercase">
							EMPRESAS
						</div>
						{#each results.companies as co}
							<a
								href="/companies"
								onclick={clear}
								class="flex items-center justify-between px-4 py-2.5 hover:bg-[#111] transition-colors"
							>
								<span class="text-[11px] text-white normal-case" style="letter-spacing:0;">{co.name}</span>
								<span class="text-[9px] text-[#444] uppercase tracking-widest">{co.industry || ''}</span>
							</a>
						{/each}
					{/if}

					<!-- Deals -->
					{#if results && results.deals.length > 0}
						<div class="border-b border-[#111] border-t border-t-[#111] px-3 py-1.5 text-[8px] text-[#333] tracking-widest uppercase">
							NEGOCIOS
						</div>
						{#each results.deals as d}
							<a
								href="/deals"
								onclick={clear}
								class="flex items-center justify-between px-4 py-2.5 hover:bg-[#111] transition-colors"
							>
								<span class="text-[11px] text-white normal-case" style="letter-spacing:0;">{d.title}</span>
								<div class="flex items-center gap-2 text-[9px]">
									{#if d.value}
										<span class="text-emerald-500">{d.currency} {d.value.toLocaleString('es',{maximumFractionDigits:0})}</span>
									{/if}
									<span class="text-[#444] uppercase tracking-widest">{stageLabel[d.stage] ?? d.stage}</span>
								</div>
							</a>
						{/each}
					{/if}

					<!-- Tasks -->
					{#if results && results.tasks.length > 0}
						<div class="border-b border-[#111] border-t border-t-[#111] px-3 py-1.5 text-[8px] text-[#333] tracking-widest uppercase">
							TAREAS
						</div>
						{#each results.tasks as t}
							<a
								href="/tasks"
								onclick={clear}
								class="flex items-center justify-between px-4 py-2.5 hover:bg-[#111] transition-colors"
							>
								<span class="text-[11px] normal-case {t.status === 'done' ? 'line-through text-[#444]' : 'text-white'}"
									style="letter-spacing:0;">{t.title}</span>
								<span class="text-[9px] text-[#444] uppercase tracking-widest">{t.priority || ''}</span>
							</a>
						{/each}
					{/if}

				</div>
				<!-- Footer -->
				<div class="border-t border-[#111] px-4 py-2 text-[8px] text-[#333] uppercase tracking-widest">
					{total} RESULTADO{total !== 1 ? 'S' : ''} — ESC PARA CERRAR
				</div>
			{/if}
		</div>
	{/if}
</div>
