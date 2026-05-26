<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	interface Props extends HTMLTextareaAttributes { error?: boolean; }
	let { error = false, class: extraClass = '', value = $bindable(), ...rest }: Props = $props();
</script>
<textarea bind:value
	class="w-full resize-none border px-3 py-2.5 text-[11px] tracking-wide outline-none transition-colors
		bg-transparent text-white placeholder:text-[#444]
		{error ? 'border-red-500 focus:border-red-400' : 'border-[#222] focus:border-white'}
		{extraClass}"
	{...rest}
></textarea>
