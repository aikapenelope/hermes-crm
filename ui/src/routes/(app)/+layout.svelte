<script lang="ts">
	import { page } from '$app/stores';
	import { afterNavigate, goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import pb from '$lib/pb';
	import { currentUser } from '$lib/stores';
	import { GlobalSearch } from '$lib/ui';

	let { children } = $props();

	// ── Mobile sidebar ──────────────────────────────────────────────────────
	let sidebarOpen = $state(false);
	afterNavigate(() => { sidebarOpen = false; });

	// ── Nav groups ──────────────────────────────────────────────────────────
	const navGroups = [
		{
			label: 'MAIN // OPS',
			items: [
				{ href: '/',           label: 'DASHBOARD'  },
				{ href: '/contacts',   label: 'CONTACTOS'  },
				{ href: '/companies',  label: 'EMPRESAS'   },
				{ href: '/deals',      label: 'NEGOCIOS'   },
				{ href: '/calendar',   label: 'CALENDARIO' },
			],
		},
		{
			label: 'ANALYTICS // MGMT',
			items: [
				{ href: '/tasks',          label: 'TAREAS'    },
				{ href: '/goals',          label: 'METAS'     },
				{ href: '/deals/forecast', label: 'FORECAST'  },
				{ href: '/segments',       label: 'SEGMENTOS' },
				{ href: '/products',       label: 'PRODUCTOS' },
			],
		},
		{
			label: 'HERMES // LOG',
			items: [
				{ href: '/emails',  label: 'EMAILS'   },
				{ href: '/reports', label: 'REPORTES' },
			],
		},
		{
			label: 'CUENTA',
			items: [
				{ href: '/settings', label: 'AJUSTES' },
			],
		},
	];

	function isActive(href: string) {
		if (href === '/') return $page.url.pathname === '/';
		return $page.url.pathname.startsWith(href);
	}

	async function logout() {
		pb.authStore.clear();
		await goto('/login');
	}

	// ── Live clock ──────────────────────────────────────────────────────────
	let timeStr  = $state('');
	let tzOffset = $state('');

	function tick() {
		const now = new Date();
		timeStr = now.toLocaleTimeString('es', { hour12: false });
		const off = -(now.getTimezoneOffset() / 60);
		tzOffset = `UTC${off >= 0 ? '+' : ''}${off}`;
	}
	tick();
	const clockInterval = setInterval(tick, 1000);
	onDestroy(() => clearInterval(clockInterval));

	// ── Footer stats ────────────────────────────────────────────────────────
	let pipelineTotal = $state(0);
	let tasksDueToday = $state(0);

	onMount(async () => {
		const today = new Date().toISOString().slice(0, 10);
		try {
			const [deals, tasks] = await Promise.all([
				pb.collection('deals').getFullList({
					filter: "stage != 'won' && stage != 'lost'",
					fields: 'value',
				}),
				pb.collection('tasks').getList(1, 1, {
					filter: `status != 'done' && due_date != '' && due_date <= '${today} 23:59:59'`,
				}),
			]);
			pipelineTotal = (deals as { value?: number }[]).reduce(
				(s, d) => s + (d.value ?? 0), 0,
			);
			tasksDueToday = tasks.totalItems;
		} catch { /* non-critical */ }
	});

	// ── User info ───────────────────────────────────────────────────────────
	const userInitials = $derived(() => {
		const raw = String($currentUser?.get?.('name') ?? $currentUser?.email ?? 'AG');
		return raw.split(/[\s@]+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
	});
	const userName = $derived(
		String($currentUser?.get?.('name') ?? $currentUser?.email ?? 'AGENTE').toUpperCase(),
	);
</script>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- ROOT                                                                     -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<div class="flex h-screen overflow-hidden bg-[#070707] text-[#888] selection:bg-[#333]"
     style="font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace; font-size: 11px; letter-spacing: 0.08em;">

	<!-- ── Mobile overlay ──────────────────────────────────────────────────── -->
	{#if sidebarOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-30 bg-black/70 lg:hidden"
			role="presentation"
			onclick={() => { sidebarOpen = false; }}
			transition:fade={{ duration: 150 }}
		></div>
	{/if}

	<!-- ════════════════════════════════════════════════════════════════════ -->
	<!-- SIDEBAR                                                              -->
	<!-- ════════════════════════════════════════════════════════════════════ -->
	<aside
		class="fixed inset-y-0 left-0 z-40 flex w-64 flex-shrink-0 flex-col justify-between
			border-r border-[#1a1a1a] bg-[#070707]
			transition-transform duration-200
			{sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
			lg:relative lg:translate-x-0"
	>
		<div>
			<!-- System header -->
			<div class="p-6 pb-10">
				<div class="mb-1 text-[9px] tracking-widest text-[#555] uppercase">SYS.NAVIGATION</div>
				<div class="flex items-center justify-between tracking-widest text-[#999] uppercase">
					<span>V.2026.CRM</span>
					<span class="text-[#444]">ID: HRM-01</span>
				</div>
			</div>

			<!-- Nav groups -->
			<nav class="space-y-8">
				{#each navGroups as group}
					<div>
						<div class="mb-4 px-6 text-[9px] tracking-widest text-[#444] uppercase">
							{group.label}
						</div>
						<ul class="space-y-0.5">
							{#each group.items as item}
								<li class="relative">
									{#if isActive(item.href)}
										<!-- Rainbow top line on active item -->
										<div class="absolute top-0 left-0 right-0 h-[1px]"
											style="background: linear-gradient(to right, #ff3333, #ffaa00, #00ffaa, #00aaff, #aa00ff);">
										</div>
									{/if}
									<a
										href={item.href}
										class="block px-6 py-3 tracking-widest uppercase transition-colors
											{isActive(item.href)
											? 'bg-[#111] text-white'
											: 'hover:text-white'}"
									>
										{item.label}
									</a>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</nav>
		</div>

		<!-- Bottom: user / logout -->
		<div class="p-6">
			<button
				onclick={logout}
				class="tracking-widest uppercase hover:text-white transition-colors text-left w-full"
				title="Cerrar sesión"
			>
				{userName.split('@')[0].slice(0, 18)}
			</button>
		</div>
	</aside>

	<!-- ════════════════════════════════════════════════════════════════════ -->
	<!-- MAIN                                                                 -->
	<!-- ════════════════════════════════════════════════════════════════════ -->
	<main class="flex flex-1 flex-col overflow-hidden">

		<!-- ── Topbar ──────────────────────────────────────────────────────── -->
		<header class="flex h-16 flex-shrink-0 items-center justify-between
			border-b border-[#1a1a1a] px-6 lg:px-8">

			<!-- Left: hamburger (mobile) + brand + status -->
			<div class="flex items-center gap-4 lg:gap-6">
				<!-- Hamburger — mobile only -->
				<button
					onclick={() => { sidebarOpen = true; }}
					class="text-[#555] hover:text-white transition-colors lg:hidden"
					aria-label="Abrir menú"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
					</svg>
				</button>

				<!-- Brand -->
				<div class="text-white font-bold tracking-tight" style="font-size: 16px; letter-spacing: -0.02em; font-family: system-ui, sans-serif;">
					HERMES<span class="text-[#444]">.</span>CRM
				</div>

				<!-- Status -->
				<div class="hidden items-center gap-2 text-[9px] tracking-widest text-[#555] uppercase sm:flex">
					<div class="h-1.5 w-1.5 rounded-full bg-yellow-500"></div>
					SISTEMA.ONLINE // SINCRONIZADO
				</div>
			</div>

			<!-- Center: global search -->
			<div class="hidden flex-1 px-8 lg:flex" style="max-width: 480px;">
				<GlobalSearch />
			</div>

			<!-- Right: user info -->
			<div class="flex items-center gap-3">
				<div class="h-1.5 w-1.5 rounded-full bg-blue-500 hidden sm:block"></div>
				<div class="hidden text-right leading-tight sm:block">
					<div class="text-white tracking-widest uppercase" style="font-size: 12px; font-family: system-ui, sans-serif; font-weight: 600;">
						{userName.split('@')[0].slice(0, 16)}
					</div>
					<div class="text-[9px] tracking-widest text-[#555] uppercase">AGENTE.CRM</div>
				</div>
				<div class="flex h-8 w-8 items-center justify-center border border-[#333]
					bg-[#1a1a1a] text-[11px] font-bold text-white tracking-widest">
					{userInitials()}
				</div>
			</div>
		</header>

		<!-- ── Scrollable content ───────────────────────────────────────────── -->
		<div class="flex-1 overflow-y-auto" style="padding-bottom: var(--footer-h);">
			{@render children()}
		</div>
	</main>

</div>

<!-- ════════════════════════════════════════════════════════════════════════ -->
<!-- FOOTER — fixed status bar                                               -->
<!-- ════════════════════════════════════════════════════════════════════════ -->
<footer
	class="fixed bottom-0 right-0 z-20 flex h-12 items-center justify-between
		border-t border-[#1a1a1a] bg-[#070707] px-6 lg:px-8
		left-0 lg:left-64"
>
	<div class="flex gap-8 lg:gap-12">
		<div class="flex items-center gap-3">
			<div class="text-[9px] tracking-widest text-[#444] uppercase">PIPELINE_TOTAL</div>
			<div class="text-[11px] text-white">
				${pipelineTotal.toLocaleString('es', { maximumFractionDigits: 0 })}
				<span class="text-[#444] text-[9px] ml-1">/ USD</span>
			</div>
		</div>
		<div class="hidden items-center gap-3 sm:flex">
			<div class="text-[9px] tracking-widest text-[#444] uppercase">TAREAS_HOY</div>
			<div class="text-[11px] text-white">
				{tasksDueToday}
				<span class="text-[#444] text-[9px] ml-1">/ VENCIDAS</span>
			</div>
		</div>
	</div>

	<div class="flex items-center gap-3">
		<div class="hidden text-[9px] tracking-widest text-[#444] uppercase sm:block">
			{tzOffset} // {timeStr}
		</div>
		<div class="flex gap-0.5">
			<div class="h-3 w-1 bg-blue-500"></div>
			<div class="h-3 w-1 bg-yellow-500"></div>
			<div class="h-3 w-1 bg-white"></div>
		</div>
	</div>
</footer>
