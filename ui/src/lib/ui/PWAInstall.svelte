<script lang="ts">
	import { onMount } from 'svelte';

	// ── State ─────────────────────────────────────────────────────────────────
	let deferredPrompt = $state<Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> } | null>(null);
	let showBanner     = $state(false);
	let isIOS          = $state(false);
	let isInstalled    = $state(false);

	onMount(() => {
		// Already installed (standalone mode) — don't show
		if (window.matchMedia('(display-mode: standalone)').matches
			|| (navigator as Navigator & { standalone?: boolean }).standalone === true) {
			isInstalled = true;
			return;
		}

		// Dismissed previously
		if (localStorage.getItem('pwa-install-dismissed') === '1') return;

		// iOS detection — Safari doesn't fire beforeinstallprompt
		const ua = navigator.userAgent;
		const ios = /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
		if (ios) {
			isIOS = true;
			// Show iOS instructions after 3s on first visit
			setTimeout(() => { showBanner = true; }, 3000);
			return;
		}

		// Chrome / Android — listen for install prompt
		window.addEventListener('beforeinstallprompt', (e: Event) => {
			e.preventDefault();
			deferredPrompt = e as typeof deferredPrompt;
			setTimeout(() => { showBanner = true; }, 2000);
		});

		// Already installed via another mechanism
		window.addEventListener('appinstalled', () => {
			showBanner = false;
			isInstalled = true;
		});
	});

	async function install() {
		if (!deferredPrompt) return;
		await deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		if (outcome === 'accepted') {
			isInstalled = true;
		}
		deferredPrompt = null;
		showBanner = false;
	}

	function dismiss() {
		showBanner = false;
		localStorage.setItem('pwa-install-dismissed', '1');
	}
</script>

{#if showBanner && !isInstalled}
	<!-- PWA install banner — appears at bottom on mobile, top-right on desktop -->
	<div
		class="fixed z-50 flex items-center gap-3
			bottom-[calc(3.5rem+env(safe-area-inset-bottom)+8px)] left-2 right-2
			lg:bottom-auto lg:top-4 lg:left-auto lg:right-4 lg:w-80
			border border-[#333] bg-[#0a0a0a] px-4 py-3 shadow-2xl"
	>
		<!-- Rainbow left accent -->
		<div class="absolute left-0 top-0 bottom-0 w-[2px]"
			style="background:linear-gradient(to bottom,#ff3333,#ffaa00,#00ffaa,#00aaff,#aa00ff);">
		</div>

		<!-- Icon -->
		<div class="shrink-0 pl-1">
			<img src="/icon-192.png" alt="Hermes CRM" class="h-8 w-8" />
		</div>

		<!-- Text -->
		<div class="flex-1 min-w-0">
			{#if isIOS}
				<div class="text-[10px] font-bold text-white tracking-widest uppercase">
					Instalar app
				</div>
				<div class="mt-0.5 text-[9px] text-[#555] normal-case leading-relaxed">
					Toca <strong class="text-[#888]">Compartir</strong> y luego
					<strong class="text-[#888]">"Añadir a inicio"</strong>
				</div>
			{:else}
				<div class="text-[10px] font-bold text-white tracking-widest uppercase">
					Instalar Hermes CRM
				</div>
				<div class="mt-0.5 text-[9px] text-[#555] normal-case">
					Acceso rápido desde tu pantalla de inicio
				</div>
			{/if}
		</div>

		<!-- Actions -->
		<div class="flex shrink-0 items-center gap-2">
			{#if !isIOS}
				<button
					onclick={install}
					class="border border-white bg-white px-3 py-1.5 text-[9px] font-bold
						tracking-widest uppercase text-black hover:bg-[#e0e0e0] transition-colors"
				>
					INSTALAR
				</button>
			{/if}
			<button
				onclick={dismiss}
				class="p-1.5 text-[#444] hover:text-white transition-colors"
				aria-label="Cerrar"
			>
				<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	</div>
{/if}
