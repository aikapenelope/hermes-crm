<script lang="ts">
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { Users, Briefcase, CheckSquare, MessageCircle, TrendingUp } from 'lucide-svelte';

	interface Stats {
		contacts: number;
		openDeals: number;
		dueTasks: number;
		todayConversations: number;
		wonDealsValue: number;
	}

	let stats = $state<Stats | null>(null);
	let recentContacts = $state<Record<string, unknown>[]>([]);
	let loading = $state(true);

	onMount(async () => {
		const today = new Date().toISOString().slice(0, 10);
		try {
			const [c, d, t, conv, won, recent] = await Promise.all([
				pb.collection('contacts').getList(1, 1),
				pb.collection('deals').getList(1, 1, {
					filter: "stage != 'won' && stage != 'lost'",
				}),
				pb.collection('tasks').getList(1, 1, {
					filter: `status != 'done' && due_date != '' && due_date <= '${today} 23:59:59'`,
				}),
				pb.collection('conversations').getList(1, 1, {
					filter: `created >= '${today} 00:00:00'`,
				}),
				pb.collection('deals').getFullList({
					filter: "stage = 'won'",
					fields: 'value',
				}),
				pb.collection('contacts').getList(1, 5, {
					sort: '-created',
					fields: 'id,name,email,status,created',
				}),
			]);

			stats = {
				contacts: c.totalItems,
				openDeals: d.totalItems,
				dueTasks: t.totalItems,
				todayConversations: conv.totalItems,
				wonDealsValue: won.reduce((sum, r) => sum + (((r as unknown) as {value: number}).value ?? 0), 0),
			};
			recentContacts = recent.items as Record<string, unknown>[];
		} finally {
			loading = false;
		}
	});

	const statCards = $derived(
		stats
			? [
					{
						label: 'Contactos',
						value: stats.contacts,
						Icon: Users,
						color: 'text-blue-400',
						bg: 'bg-blue-900/30',
					},
					{
						label: 'Negocios abiertos',
						value: stats.openDeals,
						Icon: Briefcase,
						color: 'text-amber-400',
						bg: 'bg-amber-900/30',
					},
					{
						label: 'Tareas vencidas',
						value: stats.dueTasks,
						Icon: CheckSquare,
						color: 'text-rose-400',
						bg: 'bg-rose-900/30',
					},
					{
						label: 'Mensajes hoy',
						value: stats.todayConversations,
						Icon: MessageCircle,
						color: 'text-emerald-400',
						bg: 'bg-emerald-900/30',
					},
				]
			: []
	);

	const statusColors: Record<string, string> = {
		lead: 'bg-slate-700 text-slate-300',
		prospect: 'bg-blue-900/60 text-blue-300',
		customer: 'bg-emerald-900/60 text-emerald-300',
		churned: 'bg-rose-900/60 text-rose-300',
		inactive: 'bg-slate-700 text-slate-400',
	};
</script>

<svelte:head><title>Dashboard — Hermes CRM</title></svelte:head>

<div class="flex-1 p-6">
	<!-- Header -->
	<div class="mb-6">
		<h1 class="text-xl font-semibold text-slate-100">Dashboard</h1>
		<p class="text-sm text-slate-400">Resumen de tu negocio</p>
	</div>

	{#if loading}
		<div class="flex items-center gap-2 text-sm text-slate-400">
			<div class="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500"></div>
			Cargando…
		</div>
	{:else}
		<!-- Stat cards -->
		<div class="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
			{#each statCards as card}
				<div class="rounded-xl border border-slate-800 bg-slate-900 p-4">
					<div class="mb-3 flex items-center justify-between">
						<span class="text-xs font-medium text-slate-400">{card.label}</span>
						<div class="rounded-lg {card.bg} p-1.5">
							<card.Icon class="h-4 w-4 {card.color}" />
						</div>
					</div>
					<p class="text-2xl font-bold text-slate-100">{card.value.toLocaleString()}</p>
				</div>
			{/each}
		</div>

		<!-- Won deals value -->
		{#if stats}
			<div class="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
				<div class="flex items-center gap-2 text-sm font-medium text-slate-300">
					<TrendingUp class="h-4 w-4 text-emerald-400" />
					Ingresos cerrados (negocios ganados)
				</div>
				<p class="mt-2 text-3xl font-bold text-emerald-400">
					${stats.wonDealsValue.toLocaleString('es', { minimumFractionDigits: 0 })}
				</p>
			</div>
		{/if}

		<!-- Recent contacts -->
		<div class="rounded-xl border border-slate-800 bg-slate-900">
			<div class="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
				<h2 class="text-sm font-semibold text-slate-200">Contactos recientes</h2>
				<a href="/contacts" class="text-xs text-blue-400 hover:text-blue-300">Ver todos →</a>
			</div>
			{#if recentContacts.length === 0}
				<p class="px-4 py-8 text-center text-sm text-slate-500">Sin contactos aún</p>
			{:else}
				<ul class="divide-y divide-slate-800">
					{#each recentContacts as c}
						<li>
							<a
								href="/contacts/{c.id}"
								class="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 transition-colors"
							>
								<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-300">
									{String(c.name ?? c.email ?? '?')[0].toUpperCase()}
								</div>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium text-slate-200">{c.name as string}</p>
									<p class="truncate text-xs text-slate-500">{c.email as string}</p>
								</div>
								{#if c.status}
									<span class="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium {statusColors[c.status as string] ?? 'bg-slate-700 text-slate-400'}">
										{c.status as string}
									</span>
								{/if}
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>
