<script lang="ts">
	import { page } from '$app/stores';
	import { afterNavigate } from '$app/navigation';
	import { goto } from '$app/navigation';
	import { fly, fade } from 'svelte/transition';
	import pb from '$lib/pb';
	import { currentUser } from '$lib/stores';
	import {
		LayoutDashboard, Users, Building2, Briefcase,
		MessageCircle, CheckSquare, Package, BarChart2,
		LogOut, Menu, X,
	} from 'lucide-svelte';

	let { children } = $props();

	let sidebarOpen = $state(false);

	// Close sidebar on navigation (mobile UX)
	afterNavigate(() => { sidebarOpen = false; });

	const nav = [
		{ href: '/',              label: 'Dashboard',      Icon: LayoutDashboard },
		{ href: '/contacts',      label: 'Contactos',      Icon: Users           },
		{ href: '/companies',     label: 'Empresas',       Icon: Building2       },
		{ href: '/deals',         label: 'Negocios',       Icon: Briefcase       },
		{ href: '/conversations', label: 'Conversaciones', Icon: MessageCircle   },
		{ href: '/tasks',         label: 'Tareas',         Icon: CheckSquare     },
		{ href: '/products',      label: 'Productos',      Icon: Package         },
		{ href: '/segments',      label: 'Segmentos',      Icon: BarChart2       },
	];

	function isActive(href: string) {
		if (href === '/') return $page.url.pathname === '/';
		return $page.url.pathname.startsWith(href);
	}

	async function logout() {
		pb.authStore.clear();
		await goto('/login');
	}

	const userInitial = $derived(
		String($currentUser?.get?.('name') ?? $currentUser?.email ?? '?')[0].toUpperCase()
	);
	const userName = $derived(
		String($currentUser?.get?.('name') ?? $currentUser?.email ?? 'Usuario')
	);
	const userEmail = $derived(String($currentUser?.email ?? ''));
</script>

<div class="relative flex h-screen overflow-hidden">

	<!-- ── Mobile overlay ─────────────────────────────────────────────────── -->
	{#if sidebarOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-30 bg-black/60 backdrop-blur-[2px] lg:hidden"
			role="presentation"
			onclick={() => { sidebarOpen = false; }}
			transition:fade={{ duration: 200 }}
		></div>
	{/if}

	<!-- ── Sidebar ─────────────────────────────────────────────────────────── -->
	<aside
		class="
			fixed inset-y-0 left-0 z-40 flex w-[var(--sidebar-w)] shrink-0 flex-col
			border-r border-slate-800 bg-slate-900
			transition-transform duration-250 ease-in-out
			{sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
			lg:relative lg:translate-x-0 lg:shadow-none
		"
		aria-label="Navegación principal"
	>
		<!-- Brand -->
		<div class="flex h-14 items-center justify-between border-b border-slate-800 px-4">
			<div class="flex items-center gap-2.5">
				<div class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
					<svg class="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none"
						stroke="currentColor" stroke-width="2.5">
						<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
					</svg>
				</div>
				<span class="text-sm font-semibold text-slate-100">Hermes CRM</span>
			</div>
			<!-- Close btn on mobile -->
			<button
				onclick={() => { sidebarOpen = false; }}
				class="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 lg:hidden"
				aria-label="Cerrar menú"
			>
				<X class="h-4 w-4" />
			</button>
		</div>

		<!-- Nav links -->
		<nav class="flex-1 overflow-y-auto px-2 py-3" aria-label="Menú principal">
			{#each nav as item}
				<a
					href={item.href}
					class="mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors
						{isActive(item.href)
						? 'bg-slate-800 text-slate-100 font-medium'
						: 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}"
				>
					<item.Icon class="h-4 w-4 shrink-0" />
					{item.label}
				</a>
			{/each}
		</nav>

		<!-- User footer -->
		<div class="border-t border-slate-800 p-3">
			<div class="flex items-center gap-2.5 rounded-lg px-2 py-2">
				<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full
					bg-gradient-to-br from-blue-600/50 to-violet-600/50 text-xs font-bold text-slate-200">
					{userInitial}
				</div>
				<div class="min-w-0 flex-1">
					<p class="truncate text-xs font-medium text-slate-200">{userName}</p>
					<p class="truncate text-xs text-slate-500">{userEmail}</p>
				</div>
				<button
					onclick={logout}
					class="rounded-lg p-1.5 text-slate-500 transition-colors hover:text-red-400"
					title="Cerrar sesión"
					aria-label="Cerrar sesión"
				>
					<LogOut class="h-4 w-4" />
				</button>
			</div>
		</div>
	</aside>

	<!-- ── Main content ────────────────────────────────────────────────────── -->
	<div class="flex flex-1 flex-col overflow-hidden">
		<!-- Mobile topbar -->
		<header class="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950 px-4 lg:hidden">
			<button
				onclick={() => { sidebarOpen = true; }}
				class="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
				aria-label="Abrir menú"
			>
				<Menu class="h-5 w-5" />
			</button>
			<div class="flex items-center gap-2">
				<div class="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600">
					<svg class="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none"
						stroke="currentColor" stroke-width="2.5">
						<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
					</svg>
				</div>
				<span class="text-sm font-semibold text-slate-100">Hermes CRM</span>
			</div>
			<!-- Right side: current page indicator or avatar -->
			<div class="flex h-8 w-8 items-center justify-center rounded-full
				bg-gradient-to-br from-blue-600/50 to-violet-600/50 text-xs font-bold text-slate-200">
				{userInitial}
			</div>
		</header>

		<!-- Page content -->
		<main class="flex flex-1 flex-col overflow-y-auto bg-slate-950">
			{@render children()}
		</main>
	</div>
</div>
