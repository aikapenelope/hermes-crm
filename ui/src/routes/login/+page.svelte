<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { Btn, Input, FormField } from '$lib/ui';

	let email    = $state('');
	let password = $state('');
	let loading  = $state(false);

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

<div class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#070707] px-4"
	style="font-family:ui-monospace,monospace;">
	<!-- Subtle grid lines -->
	<div class="pointer-events-none absolute inset-0"
		style="background-image:linear-gradient(#0d0d0d 1px,transparent 1px),linear-gradient(to right,#0d0d0d 1px,transparent 1px);background-size:40px 40px;">
	</div>

	<div class="relative w-full max-w-sm">
		<!-- Logo / header -->
		<div class="mb-8 text-center">
			<div class="mb-4 inline-flex h-12 w-12 items-center justify-center border border-[#333] bg-[#111]">
				<svg class="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
					<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
				</svg>
			</div>
			<div class="text-xs font-bold tracking-widest text-white uppercase">HERMES.CRM</div>
			<p class="mt-1 text-[9px] tracking-widest text-[#444] uppercase">Sistema de gestión</p>
		</div>

		<!-- Login card -->
		<div class="border border-[#1a1a1a] bg-[#090909] p-6 relative overflow-hidden">
			<!-- Top accent -->
			<div class="absolute top-0 left-0 right-0 h-[1px]"
				style="background:linear-gradient(to right,#ff3333,#ffaa00,#00ffaa,#00aaff,#aa00ff);"></div>

			<form onsubmit={handleLogin} class="space-y-4">
				<FormField label="Email">
					<Input id="email" type="email" bind:value={email} required
						autocomplete="email" placeholder="tu@empresa.com" />
				</FormField>

				<FormField label="Contraseña">
					<Input id="password" type="password" bind:value={password} required
						autocomplete="current-password" placeholder="••••••••" />
				</FormField>

				<div class="pt-1">
					<Btn type="submit" variant="primary" class="w-full"
						loading={loading} disabled={!email.trim() || !password}>
						{loading ? 'ENTRANDO…' : 'INICIAR SESIÓN'}
					</Btn>
				</div>
			</form>
		</div>

		<p class="mt-6 text-center text-[8px] tracking-widest text-[#333] uppercase">
			Hermes CRM · Plataforma Martes
		</p>
	</div>
</div>
