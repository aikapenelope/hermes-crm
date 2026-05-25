<script lang="ts">
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { Btn, Badge, Skeleton } from '$lib/ui';
	import { Users, Briefcase, CheckSquare, MessageCircle, TrendingUp, ArrowRight } from 'lucide-svelte';

	interface Stats {
		contacts: number;
		openDeals: number;
		dueTasks: number;
		todayConversations: number;
		wonDealsValue: number;
	}

	let stats          = $state<Stats | null>(null);
	let recentContacts = $state<Record<string, unknown>[]>([]);
	let loading        = $state(true);

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
				pb.collection('contacts').getList(1, 6, {
					sort: '-created',
					fields: 'id,name,email,status,created',
				}),
			]);

			stats = {
				contacts: c.totalItems,
				openDeals: d.totalItems,
				dueTasks: t.totalItems,
				todayConversations: conv.totalItems,
				wonDealsValue: won.reduce((sum, r) => sum + (((r as unknown) as { value: number }).value ?? 0), 0),
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
						href: '/contacts',
						Icon: Users,
						gradient: 'from-blue-600/20 to-blue-600/5',
						iconBg: 'bg-blue-600/20',
						iconColor: 'text-blue-400',
					},
					{
						label: 'Negocios abiertos',
						value: stats.openDeals,
						href: '/deals',
						Icon: Briefcase,
						gradient: 'from-amber-600/20 to-amber-600/5',
						iconBg: 'bg-amber-600/20',
						iconColor: 'text-amber-400',
					},
					{
						label: 'Tareas vencidas',
						value: stats.dueTasks,
						href: '/tasks',
						Icon: CheckSquare,
						gradient: 'from-rose-600/20 to-rose-600/5',
						iconBg: 'bg-rose-600/20',
						iconColor: 'text-rose-400',
					},
					{
						label: 'Mensajes hoy',
						value: stats.todayConversations,
						href: '/conversations',
						Icon: MessageCircle,
						gradient: 'from-emerald-600/20 to-emerald-600/5',
						iconBg: 'bg-emerald-600/20',
						iconColor: 'text-emerald-400',
					},
				]
			: []
	);

	const statusBadge: Record<string, 'slate' | 'blue' | 'green' | 'red' | 'amber'> = {
		lead: 'slate', prospect: 'blue', customer: 'green', churned: 'red', inactive: 'amber',
	};
</script>

<svelte:head><title>Dashboard — Hermes CRM</title></svelte:head>

<div class="flex-1 p-5 md:p-6">
	<div class="mb-6">
		<h1>Dashboard</h1>
		<p class="mt-0.5 text-sm text-slate-400">Resumen de tu negocio</p>
	</div>

	{#if loading}
		<Skeleton rows={4} class="mb-6" />
		<Skeleton rows={6} />
	{:else}
		<!-- Stat cards -->
		<div class="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
			{#each statCards as card}
				<a
					href={card.href}
					class="group relative overflow-hidden rounded-xl border border-slate-800
						bg-gradient-to-br {card.gradient} p-4 transition-all
						hover:border-slate-700 hover:shadow-lg"
				>
					<div class="mb-3 flex items-center justify-between">
						<span class="text-xs font-medium text-slate-400">{card.label}</span>
						<div class="rounded-lg {card.iconBg} p-1.5">
							<card.Icon class="h-4 w-4 {card.iconColor}" />
						</div>
					</div>
					<p class="text-2xl font-bold text-slate-50">{card.value.toLocaleString()}</p>
					<ArrowRight class="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-700
						opacity-0 transition-all group-hover:opacity-100 group-hover:text-slate-400" />
				</a>
			{/each}
		</div>

		<!-- Won deals -->
		{#if stats && stats.wonDealsValue > 0}
			<div class="mb-6 flex items-center justify-between rounded-xl border border-slate-800
				bg-gradient-to-r from-emerald-900/20 to-emerald-900/5 px-5 py-4">
				<div class="flex items-center gap-3">
					<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600/20">
						<TrendingUp class="h-5 w-5 text-emerald-400" />
					</div>
					<div>
						<p class="text-xs font-medium text-slate-400">Ingresos cerrados (ganados)</p>
						<p class="text-xl font-bold text-emerald-400">
							${stats.wonDealsValue.toLocaleString('es', { minimumFractionDigits: 0 })}
						</p>
					</div>
				</div>
				<a href="/deals" class="text-xs text-emerald-500 hover:text-emerald-400">
					Ver negocios →
				</a>
			</div>
		{/if}

		<!-- Recent contacts -->
		<div class="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
			<div class="flex items-center justify-between border-b border-slate-800 px-4 py-3">
				<h2>Contactos recientes</h2>
				<a href="/contacts" class="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
					Ver todos <ArrowRight class="h-3 w-3" />
				</a>
			</div>

			{#if recentContacts.length === 0}
				<div class="px-4 py-10 text-center">
					<p class="text-sm text-slate-500 mb-3">Sin contactos aún</p>
					<Btn variant="primary" size="sm" onclick={() => {}}>
						<a href="/contacts">Crear primer contacto</a>
					</Btn>
				</div>
			{:else}
				<ul class="divide-y divide-slate-800">
					{#each recentContacts as c}
						<li>
							<a
								href="/contacts/{c.id}"
								class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-800/50"
							>
								<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full
									bg-gradient-to-br from-blue-600/40 to-violet-600/40 text-xs font-bold text-slate-200">
									{String(c.name ?? c.email ?? '?')[0].toUpperCase()}
								</div>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium text-slate-200">{c.name as string}</p>
									<p class="truncate text-xs text-slate-500">{c.email as string}</p>
								</div>
								{#if c.status}
									<Badge variant={statusBadge[c.status as string] ?? 'slate'} size="sm">
										{c.status as string}
									</Badge>
								{/if}
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>
