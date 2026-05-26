<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';

	interface Props extends HTMLSelectAttributes {
		error?: boolean;
		children: import('svelte').Snippet;
	}

	let { error = false, class: extraClass = '', value = $bindable(), children, ...rest }: Props = $props();
</script>

<select
	bind:value
	class="w-full appearance-none rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors
		{error
		? 'border-red-500 bg-red-950/20 focus:border-red-400'
		: 'border-slate-700 bg-slate-800/60 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}
		{extraClass}"
	{...rest}
>
	{@render children()}
</select>
