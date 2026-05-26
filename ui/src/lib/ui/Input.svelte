<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends HTMLInputAttributes {
		error?: boolean;
	}

	let { error = false, class: extraClass = '', value = $bindable(), ...rest }: Props = $props();
</script>

<input
	bind:value
	class="w-full border px-3 py-2.5 text-[11px] tracking-wide outline-none transition-colors
		bg-transparent text-white
		placeholder:text-[#444] placeholder:tracking-widest placeholder:uppercase
		{error
		? 'border-red-500 focus:border-red-400'
		: 'border-[#222] focus:border-white'}
		{extraClass}"
	{...rest}
/>
