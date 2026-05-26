<script lang="ts">
	interface Props {
		label: string;
		required?: boolean;
		error?: string;
		children: import('svelte').Snippet;
	}
	let { label, required = false, error, children }: Props = $props();
</script>

<div>
	<label class="mb-1.5 flex items-center gap-1 text-[9px] tracking-widest text-[#555] uppercase">
		{label}
		{#if required}<span class="text-red-400">*</span>{/if}
	</label>
	{@render children()}
	{#if error}
		<p class="mt-1 text-[9px] text-red-400">{error}</p>
	{/if}
</div>
