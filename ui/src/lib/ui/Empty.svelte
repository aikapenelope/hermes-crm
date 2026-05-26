<script lang="ts">
	interface Props {
		icon?: import('svelte').Snippet;
		title: string;
		description?: string;
		action?: import('svelte').Snippet;
	}

	let { icon, title, description, action }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center py-16 text-center">
	{#if icon}
		<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-400">
			{@render icon()}
		</div>
	{/if}
	<p class="text-sm font-medium text-slate-300">{title}</p>
	{#if description}
		<p class="mt-1 text-sm text-slate-500">{description}</p>
	{/if}
	{#if action}
		<div class="mt-4">{@render action()}</div>
	{/if}
</div>
