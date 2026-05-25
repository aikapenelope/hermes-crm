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

	const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50';

	const variants: Record<string, string> = {
		primary:   'bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700',
		secondary: 'bg-slate-800 text-slate-200 hover:bg-slate-700 active:bg-slate-900 border border-slate-700',
		ghost:     'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
		danger:    'bg-red-600 text-white hover:bg-red-500 active:bg-red-700',
		outline:   'border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100',
	};

	const sizes: Record<string, string> = {
		sm: 'px-2.5 py-1.5 text-xs',
		md: 'px-3.5 py-2 text-sm',
		lg: 'px-5 py-2.5 text-base',
	};
</script>

<button
	class="{base} {variants[variant]} {sizes[size]} {extraClass}"
	disabled={disabled || loading}
	{...rest}
>
	{#if loading}
		<span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
	{:else if icon}
		{@render icon()}
	{/if}
	{@render children()}
</button>
