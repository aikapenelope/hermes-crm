<script lang="ts">
	interface Props {
		title: string; description?: string;
		icon?: import('svelte').Snippet;
		action?: import('svelte').Snippet;
	}
	let { title, description, icon, action }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center py-16 text-center uppercase tracking-widest">
	{#if icon}
		<div class="mb-4 flex h-12 w-12 items-center justify-center border border-[#222] text-[#444]">
			{@render icon()}
		</div>
	{/if}
	<p class="text-[11px] font-medium text-white">{title}</p>
	{#if description}
		<p class="mt-1 text-[9px] text-[#444]">{description}</p>
	{/if}
	{#if action}
		<div class="mt-6">{@render action()}</div>
	{/if}
</div>
