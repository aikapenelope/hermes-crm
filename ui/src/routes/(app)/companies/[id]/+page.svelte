<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import pb from '$lib/pb';
	import { toast } from '$lib/stores';
	import { Sheet, Modal, Btn, Badge, Skeleton } from '$lib/ui';
	import CompanyForm from '$lib/forms/CompanyForm.svelte';
	import { ArrowLeft, Pencil, Trash2, ExternalLink, Users, DollarSign } from 'lucide-svelte';

	const companyId = $derived($page.params.id ?? '');

	type Company = Record<string, unknown>;
	type Contact = { id: string; name: string; email: string; phone: string; status: string };
	type Deal    = { id: string; title: string; value: number; currency: string; stage: string };

	let company   = $state<Company | null>(null);
	let contacts  = $state<Contact[]>([]);
	let deals     = $state<Deal[]>([]);
	let loading   = $state(true);
	let editOpen  = $state(false);
	let deleteOpen = $state(false);
	let deleting  = $state(false);

	onMount(async () => {
		try {
			const [c, co, d] = await Promise.all([
				pb.collection('companies').getOne(companyId),
				pb.collection('contacts').getFullList<Contact>({
					filter: `company = '${companyId}'`,
					sort: 'name',
					fields: 'id,name,email,phone,status',
				}),
				pb.collection('deals').getFullList<Deal>({
					filter: `company = '${companyId}'`,
					sort: '-created',
					fields: 'id,title,value,currency,stage',
				}),
			]);
			company  = c as Company;
			contacts = co;
			deals    = d;
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error al cargar empresa');
		} finally { loading = false; }
	});

	async function handleDelete() {
		deleting = true;
		try {
			await pb.collection('companies').delete(companyId);
			toast.success('Empresa eliminada');
			await goto('/companies');
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Error');
			deleting = false;
		}
	}

	// ── Revenue stats ─────────────────────────────────────────────────────────
	const openPipeline = $derived(
		deals.filter(d => !['won','lost'].includes(d.stage))
			.reduce((s, d) => s + (d.value ?? 0), 0)
	);
	const wonRevenue = $derived(
		deals.filter(d => d.stage === 'won')
			.reduce((s, d) => s + (d.value ?? 0), 0)
	);

	const stageColors: Record<string, 'slate' | 'blue' | 'amber' | 'orange' | 'green' | 'red'> = {
		lead: 'slate', qualified: 'blue', proposal: 'amber',
		negotiation: 'orange', won: 'green', lost: 'red',
	};
	const stageLabel: Record<string, string> = {
		lead: 'LEAD', qualified: 'CALIFICADO', proposal: 'PROPUESTA',
		negotiation: 'NEGOCIACIÓN', won: 'GANADO', lost: 'PERDIDO',
	};
	const statusBadge: Record<string, 'slate' | 'blue' | 'green' | 'red' | 'amber'> = {
		lead: 'slate', prospect: 'blue', customer: 'green', churned: 'red', inactive: 'amber',
	};
	const industryLabel: Record<string, string> = {
		technology: 'Tecnología', finance: 'Finanzas', healthcare: 'Salud', retail: 'Comercio',
		manufacturing: 'Manufactura', education: 'Educación', real_estate: 'Bienes Raíces',
		hospitality: 'Hostelería', consulting: 'Consultoría', other: 'Otro',
	};
	function fmtMoney(v: number, c = 'USD') {
		return `${c} ${v.toLocaleString('es', { maximumFractionDigits: 0 })}`;
	}
</script>

<svelte:head>
	<title>{company ? String(company.name ?? 'Empresa') : 'Empresa'} — Hermes CRM</title>
</svelte:head>

<div class="flex-1 p-5 md:p-6 uppercase tracking-widest" style="font-size:11px;">
	<!-- Header -->
	<div class="mb-5 flex items-center justify-between">
		<a href="/companies" class="inline-flex items-center gap-1.5 text-[#555] hover:text-white transition-colors">
			<ArrowLeft class="h-3.5 w-3.5" />
			<span class="text-[9px]">EMPRESAS</span>
		</a>
		{#if company && !loading}
			<div class="flex items-center gap-2">
				<Btn variant="outline" size="sm" onclick={() => { editOpen = true; }}>
					{#snippet icon()}<Pencil class="h-3 w-3" />{/snippet}
					Editar
				</Btn>
				<Btn variant="ghost" size="sm" onclick={() => { deleteOpen = true; }}>
					{#snippet icon()}<Trash2 class="h-3 w-3 text-red-400" />{/snippet}
					<span class="text-red-400">Eliminar</span>
				</Btn>
			</div>
		{/if}
	</div>

	{#if loading}
		<Skeleton rows={8} />
	{:else if company}
		<div class="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">

			<!-- Left: company info + stats -->
			<div class="space-y-4">
				<!-- Company card -->
				<div class="border border-[#1a1a1a] bg-[#090909] p-5">
					<div class="mb-4 flex items-center gap-3">
						<div class="flex h-10 w-10 shrink-0 items-center justify-center border border-[#333] bg-[#111]
							text-sm font-bold text-white">
							{String(company.name ?? '?')[0].toUpperCase()}
						</div>
						<div>
							<div class="font-bold text-white normal-case" style="font-size:14px; letter-spacing:-0.01em; font-family:system-ui;">
								{company.name as string}
							</div>
							{#if company.industry}
								<div class="text-[9px] text-[#444]">{industryLabel[company.industry as string] ?? company.industry as string}</div>
							{/if}
						</div>
					</div>

					<ul class="space-y-2 text-[10px]">
						{#if company.website}
							<li class="flex items-center gap-2 text-[#666]">
								<ExternalLink class="h-3 w-3 shrink-0 text-[#444]" />
								<a href={company.website as string} target="_blank"
									class="hover:text-white transition-colors truncate normal-case">
									{String(company.website).replace(/^https?:\/\//, '')}
								</a>
							</li>
						{/if}
						{#if company.city || company.country}
							<li class="text-[#555]">
								📍 {[company.city, company.country].filter(Boolean).join(', ')}
							</li>
						{/if}
						{#if company.size}
							<li class="text-[#555]">👥 {company.size} empleados</li>
						{/if}
					</ul>

					{#if company.notes}
						<div class="mt-3 border-t border-[#1a1a1a] pt-3 text-[10px] text-[#555] leading-relaxed normal-case">
							{company.notes as string}
						</div>
					{/if}
				</div>

				<!-- Revenue stats -->
				<div class="grid grid-cols-2 gap-2">
					<div class="border border-[#1a1a1a] bg-[#090909] p-3">
						<div class="text-[9px] text-[#444]">CONTACTOS</div>
						<div class="mt-1 text-xl font-bold text-white" style="font-family:system-ui;">{contacts.length}</div>
					</div>
					<div class="border border-[#1a1a1a] bg-[#090909] p-3">
						<div class="text-[9px] text-[#444]">DEALS</div>
						<div class="mt-1 text-xl font-bold text-white" style="font-family:system-ui;">{deals.length}</div>
					</div>
					<div class="border border-[#1a1a1a] bg-[#090909] p-3">
						<div class="text-[9px] text-[#444]">PIPELINE</div>
						<div class="mt-1 text-sm font-bold text-white" style="font-family:system-ui;">
							{fmtMoney(openPipeline, deals[0]?.currency)}
						</div>
					</div>
					<div class="border border-[#1a1a1a] bg-[#090909] p-3">
						<div class="text-[9px] text-[#444]">GANADO</div>
						<div class="mt-1 text-sm font-bold text-emerald-500" style="font-family:system-ui;">
							{fmtMoney(wonRevenue, deals[0]?.currency)}
						</div>
					</div>
				</div>
			</div>

			<!-- Right: contacts + deals -->
			<div class="space-y-4">
				<!-- Contacts -->
				<div class="border border-[#1a1a1a] bg-[#090909]">
					<div class="flex items-center gap-2 border-b border-[#1a1a1a] px-4 py-2.5">
						<Users class="h-3 w-3 text-[#444]" />
						<span class="text-[9px] text-[#555]">CONTACTOS ({contacts.length})</span>
					</div>
					{#if contacts.length === 0}
						<p class="px-4 py-6 text-center text-[9px] text-[#333]">SIN CONTACTOS ASOCIADOS</p>
					{:else}
						<div class="divide-y divide-[#111]">
							{#each contacts as c}
								<a href="/contacts/{c.id}"
									class="flex items-center justify-between px-4 py-3 hover:bg-[#0d0d0d] transition-colors">
									<div class="flex items-center gap-2.5">
										<div class="flex h-6 w-6 shrink-0 items-center justify-center border border-[#222] bg-[#111]
											text-[8px] font-bold text-[#555]">
											{(c.name || '?')[0].toUpperCase()}
										</div>
										<div>
											<div class="text-[11px] text-white normal-case" style="letter-spacing:0;">{c.name}</div>
											{#if c.email}
												<div class="text-[9px] text-[#444] normal-case">{c.email}</div>
											{/if}
										</div>
									</div>
									{#if c.status}
										<Badge variant={statusBadge[c.status] ?? 'slate'} size="sm">{c.status}</Badge>
									{/if}
								</a>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Deals -->
				<div class="border border-[#1a1a1a] bg-[#090909]">
					<div class="flex items-center gap-2 border-b border-[#1a1a1a] px-4 py-2.5">
						<DollarSign class="h-3 w-3 text-[#444]" />
						<span class="text-[9px] text-[#555]">DEALS ({deals.length})</span>
					</div>
					{#if deals.length === 0}
						<p class="px-4 py-6 text-center text-[9px] text-[#333]">SIN DEALS ASOCIADOS</p>
					{:else}
						<div class="divide-y divide-[#111]">
							{#each deals as d}
								<div class="flex items-center justify-between px-4 py-3">
									<span class="text-[11px] text-[#888] normal-case" style="letter-spacing:0;">{d.title}</span>
									<div class="flex items-center gap-2">
										{#if d.value}
											<span class="text-[10px] font-bold text-emerald-500">
												{d.currency} {d.value.toLocaleString('es', {maximumFractionDigits:0})}
											</span>
										{/if}
										<Badge variant={stageColors[d.stage] ?? 'slate'} size="sm">
											{stageLabel[d.stage] ?? d.stage}
										</Badge>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<Sheet open={editOpen} title="Editar empresa" onclose={() => { editOpen = false; }}>
	{#snippet children()}
		<CompanyForm
			company={company}
			onSave={() => { editOpen = false; }}
			onClose={() => { editOpen = false; }}
		/>
	{/snippet}
</Sheet>

<Modal
	open={deleteOpen}
	title="Eliminar empresa"
	message="¿Eliminar '{String(company?.name ?? 'esta empresa')}'? Los contactos y deals quedarán sin empresa."
	confirmLabel="Eliminar"
	variant="danger"
	loading={deleting}
	onconfirm={handleDelete}
	oncancel={() => { deleteOpen = false; }}
/>
