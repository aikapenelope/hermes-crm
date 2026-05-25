<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import pb from '$lib/pb';
	import { currentUser } from '$lib/stores';
	import {
		LayoutDashboard,
		Users,
		Building2,
		Briefcase,
		MessageCircle,
		CheckSquare,
		Package,
		BarChart2,
		LogOut,
	} from 'lucide-svelte';

	let { children } = $props();

	const nav = [
		{ href: '/',               label: 'Dashboard',      Icon: LayoutDashboard },
		{ href: '/contacts',       label: 'Contactos',      Icon: Users          },
		{ href: '/companies',      label: 'Empresas',       Icon: Building2      },
		{ href: '/deals',          label: 'Negocios',       Icon: Briefcase      },
		{ href: '/conversations',  label: 'Conversaciones', Icon: MessageCircle  },
		{ href: '/tasks',          label: 'Tareas',         Icon: CheckSquare    },
		{ href: '/products',       label: 'Productos',      Icon: Package        },
		{ href: '/segments',       label: 'Segmentos',      Icon: BarChart2      },
	];

	function isActive(href: string): boolean {
		if (href === '/') return $page.url.pathname === '/';
		return $page.url.pathname.startsWith(href);
	}

	async function logout() {
		pb.authStore.clear();
		await goto('/login');
	}
</script>

<div class="flex h-screen overflow-hidden">
	<!-- ── Sidebar ─────────────────────────────────────────────────────────── -->
	<aside class="flex w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900">
		<!-- Brand -->
		<div class="flex h-14 items-center gap-2.5 border-b border-slate-800 px-4">
			<div class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
				<svg class="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"
					stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
			</div>
			<span class="text-sm font-semibold text-slate-100">Hermes CRM</span>
		</div>

		<!-- Navigation -->
		<nav class="flex-1 overflow-y-auto px-2 py-3">
			{#each nav as item}
				<a
					href={item.href}
					class="mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors
						{isActive(item.href)
						? 'bg-slate-800 text-slate-100'
						: 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}"
				>
					<item.Icon class="h-4 w-4 shrink-0" />
					{item.label}
				</a>
			{/each}
		</nav>

		<!-- User + logout -->
		<div class="border-t border-slate-800 p-3">
			<div class="flex items-center gap-2.5 rounded-lg px-2 py-2">
				<div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-300">
					{($currentUser?.get?.('name') ?? $currentUser?.email ?? '?')[0].toUpperCase()}
				</div>
				<div class="min-w-0 flex-1">
					<p class="truncate text-xs font-medium text-slate-200">
						{$currentUser?.get?.('name') ?? $currentUser?.email ?? 'Usuario'}
					</p>
					<p class="truncate text-xs text-slate-500">{$currentUser?.email ?? ''}</p>
				</div>
				<button
					onclick={logout}
					class="rounded p-1 text-slate-500 transition-colors hover:text-red-400"
					title="Cerrar sesión"
				>
					<LogOut class="h-4 w-4" />
				</button>
			</div>
		</div>
	</aside>

	<!-- ── Main content ────────────────────────────────────────────────────── -->
	<main class="flex flex-1 flex-col overflow-y-auto bg-slate-950">
		{@render children()}
	</main>
</div>
