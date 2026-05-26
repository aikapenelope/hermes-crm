<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	interface Props extends HTMLTextareaAttributes {
		error?: boolean;
	}

	let { error = false, class: extraClass = '', value = $bindable(), ...rest }: Props = $props();
</script>

<textarea
	bind:value
	class="w-full resize-none rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors
		placeholder:text-slate-500
		{error
		? 'border-red-500 bg-red-950/20 focus:border-red-400'
		: 'border-slate-700 bg-slate-800/60 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}
		{extraClass}"
	{...rest}
></textarea>
