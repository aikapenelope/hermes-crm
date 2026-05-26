<script lang="ts">
	import pb from '$lib/pb';
	import { currentUser, toast } from '$lib/stores';
	import { Btn, FormField, Input } from '$lib/ui';

	// ── Profile form ─────────────────────────────────────────────────────────
	let profileName  = $state(String($currentUser?.get?.('name') ?? ''));
	let profileEmail = $state(String($currentUser?.email ?? ''));
	let savingProfile = $state(false);

	async function saveProfile() {
		if (!profileEmail.trim()) return;
		savingProfile = true;
		try {
			const id = pb.authStore.record?.id;
			if (!id) throw new Error('No hay sesión activa');
			await pb.collection('users').update(id, {
				name:  profileName.trim() || null,
				email: profileEmail.trim(),
			});
			// Refresh auth store with updated data
			await pb.collection('users').authRefresh();
			toast.success('Perfil actualizado');
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al guardar');
		} finally { savingProfile = false; }
	}

	// ── Password form ─────────────────────────────────────────────────────────
	let oldPassword  = $state('');
	let newPassword  = $state('');
	let confirmPw    = $state('');
	let savingPw     = $state(false);
	let pwErrors     = $state<Record<string, string>>({});

	function validatePassword(): boolean {
		const e: Record<string, string> = {};
		if (!oldPassword)           e.old = 'Ingresa tu contraseña actual';
		if (newPassword.length < 8) e.new = 'Mínimo 8 caracteres';
		if (newPassword !== confirmPw) e.confirm = 'Las contraseñas no coinciden';
		pwErrors = e;
		return Object.keys(e).length === 0;
	}

	async function changePassword() {
		if (!validatePassword()) return;
		savingPw = true;
		try {
			const id = pb.authStore.record?.id;
			if (!id) throw new Error('No hay sesión activa');
			await pb.collection('users').update(id, {
				oldPassword,
				password:        newPassword,
				passwordConfirm: confirmPw,
			});
			oldPassword = '';
			newPassword = '';
			confirmPw   = '';
			toast.success('Contraseña actualizada');
		} catch (e: unknown) {
			// PocketBase returns 400 when oldPassword is wrong
			const msg = e instanceof Error ? e.message : 'Error al cambiar contraseña';
			toast.error(msg);
		} finally { savingPw = false; }
	}

	const userInitial = $derived(
		(profileName || profileEmail || '?')[0].toUpperCase()
	);
</script>

<svelte:head><title>Ajustes — Hermes CRM</title></svelte:head>

<div class="flex-1 p-5 md:p-6 max-w-lg">
	<div class="mb-8">
		<h1 class="text-xl font-semibold text-slate-50">Ajustes de cuenta</h1>
		<p class="mt-0.5 text-sm text-slate-400">Perfil y seguridad</p>
	</div>

	<!-- ── Profile card ─────────────────────────────────────────────────── -->
	<div class="mb-6 rounded-xl border border-slate-800 bg-slate-900">
		<div class="border-b border-slate-800 px-5 py-4">
			<!-- Avatar preview -->
			<div class="mb-4 flex items-center gap-3">
				<div class="flex h-12 w-12 items-center justify-center rounded-full
					bg-gradient-to-br from-blue-600/50 to-violet-600/50 text-lg font-bold text-slate-200">
					{userInitial}
				</div>
				<div>
					<p class="text-sm font-medium text-slate-200">
						{profileName || profileEmail || '—'}
					</p>
					<p class="text-xs text-slate-500">{profileEmail}</p>
				</div>
			</div>
		</div>

		<div class="space-y-4 p-5">
			<FormField label="Nombre">
				<Input
					bind:value={profileName}
					placeholder="Tu nombre o el del negocio"
					autocomplete="name"
				/>
			</FormField>

			<FormField label="Email" required>
				<Input
					type="email"
					bind:value={profileEmail}
					placeholder="tu@email.com"
					autocomplete="email"
				/>
			</FormField>

			<div class="flex justify-end pt-1">
				<Btn variant="primary" loading={savingProfile} onclick={saveProfile}>
					Guardar perfil
				</Btn>
			</div>
		</div>
	</div>

	<!-- ── Password card ────────────────────────────────────────────────── -->
	<div class="rounded-xl border border-slate-800 bg-slate-900">
		<div class="border-b border-slate-800 px-5 py-4">
			<h2 class="text-sm font-semibold text-slate-200">Cambiar contraseña</h2>
			<p class="mt-0.5 text-xs text-slate-500">Mínimo 8 caracteres</p>
		</div>

		<div class="space-y-4 p-5">
			<FormField label="Contraseña actual" error={pwErrors.old}>
				<Input
					type="password"
					bind:value={oldPassword}
					placeholder="••••••••"
					autocomplete="current-password"
					error={!!pwErrors.old}
				/>
			</FormField>

			<FormField label="Nueva contraseña" error={pwErrors.new}>
				<Input
					type="password"
					bind:value={newPassword}
					placeholder="••••••••"
					autocomplete="new-password"
					error={!!pwErrors.new}
				/>
			</FormField>

			<FormField label="Confirmar nueva contraseña" error={pwErrors.confirm}>
				<Input
					type="password"
					bind:value={confirmPw}
					placeholder="••••••••"
					autocomplete="new-password"
					error={!!pwErrors.confirm}
				/>
			</FormField>

			<div class="flex justify-end pt-1">
				<Btn variant="primary" loading={savingPw} onclick={changePassword}>
					Cambiar contraseña
				</Btn>
			</div>
		</div>
	</div>
</div>
