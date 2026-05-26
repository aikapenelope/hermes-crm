<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { Btn, Input, FormField } from '$lib/ui';

	let email    = $state('');
	let password = $state('');
	let loading  = $state(false);

	// Redirect if already logged in
	onMount(() => {
		if (pb.authStore.isValid) goto('/');
	});

	async function handleLogin(e: SubmitEvent) {
		e.preventDefault();
		if (!email.trim() || !password) return;
		loading = true;
		try {
			await pb.collection('users').authWithPassword(email.trim(), password);
			await goto('/');
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Email o contraseña incorrectos';
			toast.error(msg);
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head><title>Iniciar sesión — Hermes CRM</title></svelte:head>

<div class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4">
	<!-- Background gradient -->
	<div class="pointer-events-none absolute inset-0 overflow-hidden">
		<div class="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl"></div>
		<div class="absolute -bottom-40 left-1/4 h-80 w-80 rounded-full bg-violet-600/10 blur-3xl"></div>
	</div>

	<div class="relative w-full max-w-sm">
		<!-- Logo -->
		<div class="mb-8 text-center">
			<div class="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-600/20">
				<svg class="h-7 w-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
					<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
				</svg>
			</div>
			<h1 class="text-2xl font-bold tracking-tight text-slate-50">Hermes CRM</h1>
			<p class="mt-1.5 text-sm text-slate-400">Tu negocio, organizado</p>
		</div>

		<!-- Card -->
		<div class="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl backdrop-blur-sm">
			<form onsubmit={handleLogin} class="space-y-4">
				<FormField label="Email">
					<Input
						id="email"
						type="email"
						bind:value={email}
						required
						autocomplete="email"
						placeholder="tu@empresa.com"
					/>
				</FormField>

				<FormField label="Contraseña">
					<Input
						id="password"
						type="password"
						bind:value={password}
						required
						autocomplete="current-password"
						placeholder="••••••••"
					/>
				</FormField>

				<div class="pt-1">
					<Btn
						type="submit"
						variant="primary"
						class="w-full"
						loading={loading}
						disabled={!email.trim() || !password}
					>
						{loading ? 'Entrando…' : 'Iniciar sesión'}
					</Btn>
				</div>
			</form>
		</div>

		<p class="mt-6 text-center text-xs text-slate-600">
			Hermes CRM · Plataforma Martes
		</p>
	</div>
</div>
