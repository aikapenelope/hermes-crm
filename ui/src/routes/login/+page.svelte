<script lang="ts">
	import { goto } from '$app/navigation';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';

	let email = $state('');
	let password = $state('');
	let loading = $state(false);

	async function handleLogin(e: SubmitEvent) {
		e.preventDefault();
		loading = true;
		try {
			await pb.collection('users').authWithPassword(email, password);
			await goto('/');
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Error al iniciar sesión';
			toast.error(msg);
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head><title>Hermes CRM — Iniciar sesión</title></svelte:head>

<div class="flex min-h-screen items-center justify-center bg-slate-950 px-4">
	<div class="w-full max-w-sm">
		<!-- Logo / brand -->
		<div class="mb-8 text-center">
			<div class="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
				<svg class="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"
					stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
			</div>
			<h1 class="text-xl font-semibold text-slate-100">Hermes CRM</h1>
			<p class="mt-1 text-sm text-slate-400">Accede a tu cuenta</p>
		</div>

		<!-- Form -->
		<form onsubmit={handleLogin} class="space-y-4">
			<div>
				<label for="email" class="mb-1.5 block text-sm font-medium text-slate-300">Email</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					required
					autocomplete="email"
					placeholder="tu@email.com"
					class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm
						text-slate-100 placeholder-slate-500 outline-none
						focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
				/>
			</div>

			<div>
				<label for="password" class="mb-1.5 block text-sm font-medium text-slate-300">
					Contraseña
				</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					required
					autocomplete="current-password"
					class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm
						text-slate-100 placeholder-slate-500 outline-none
						focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
				/>
			</div>

			<button
				type="submit"
				disabled={loading}
				class="mt-2 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white
					transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
			>
				{loading ? 'Entrando…' : 'Iniciar sesión'}
			</button>
		</form>
	</div>
</div>
