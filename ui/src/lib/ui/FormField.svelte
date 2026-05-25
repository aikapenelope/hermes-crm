<script lang="ts">
	interface Props {
		label: string;
		error?: string;
		hint?: string;
		required?: boolean;
		children: import('svelte').Snippet;
	}

	let { label, error, hint, required = false, children }: Props = $props();
</script>

<div class="flex flex-col gap-1.5">
	<!-- svelte-ignore a11y_label_has_associated_control -->
	<label class="text-sm font-medium text-slate-300">
		{label}
		{#if required}
			<span class="ml-0.5 text-red-400" aria-hidden="true">*</span>
		{/if}
	</label>

	{@render children()}

	{#if error}
		<p class="text-xs text-red-400" role="alert">{error}</p>
	{:else if hint}
		<p class="text-xs text-slate-500">{hint}</p>
	{/if}
</div>
