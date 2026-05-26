<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
		size?: 'sm' | 'md' | 'lg';
		loading?: boolean;
		icon?: import('svelte').Snippet;
		children: import('svelte').Snippet;
	}

	let {
		variant = 'primary',
		size = 'md',
		loading = false,
		disabled,
		icon,
		children,
		class: extraClass = '',
		...rest
	}: Props = $props();

	const base = 'inline-flex items-center justify-center gap-2 font-medium tracking-widest uppercase transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-40';

	const variants: Record<string, string> = {
		primary:   'bg-white text-black hover:bg-[#e0e0e0] active:bg-[#ccc]',
		secondary: 'bg-transparent text-[#888] hover:text-white border border-[#333] hover:border-[#555]',
		ghost:     'text-[#555] hover:text-white transition-colors',
		danger:    'bg-red-600 text-white hover:bg-red-500 active:bg-red-700',
		outline:   'border border-[#333] text-[#888] hover:border-white hover:text-white',
	};

	const sizes: Record<string, string> = {
		sm: 'px-2.5 py-1.5 text-[9px]',
		md: 'px-3.5 py-2 text-[10px]',
		lg: 'px-5 py-2.5 text-xs',
	};
</script>

<button
	class="{base} {variants[variant]} {sizes[size]} {extraClass}"
	disabled={disabled || loading}
	{...rest}
>
	{#if loading}
		<span class="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"></span>
	{:else if icon}
		{@render icon()}
	{/if}
	{@render children()}
</button>
