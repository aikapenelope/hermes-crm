<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';
	interface Props extends HTMLSelectAttributes { error?: boolean; children: import('svelte').Snippet; }
	let { error = false, class: extraClass = '', value = $bindable(), children, ...rest }: Props = $props();
</script>
<select bind:value
	class="w-full appearance-none border px-3 py-2.5 text-[11px] tracking-wide outline-none transition-colors
		bg-[#0a0a0a] text-white
		{error ? 'border-red-500 focus:border-red-400' : 'border-[#222] focus:border-white'}
		{extraClass}"
	{...rest}
>
	{@render children()}
</select>
