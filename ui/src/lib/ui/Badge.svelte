<script lang="ts">
	interface Props {
		variant?: 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'orange' | 'violet';
		size?: 'sm' | 'md';
		children: import('svelte').Snippet;
	}

	let { variant = 'slate', size = 'sm', children }: Props = $props();

	const styles: Record<string, string> = {
		slate:  'bg-slate-800 text-slate-300 ring-slate-700/50',
		blue:   'bg-blue-900/50 text-blue-300 ring-blue-700/30',
		green:  'bg-emerald-900/50 text-emerald-300 ring-emerald-700/30',
		amber:  'bg-amber-900/50 text-amber-300 ring-amber-700/30',
		red:    'bg-red-900/50 text-red-300 ring-red-700/30',
		orange: 'bg-orange-900/50 text-orange-300 ring-orange-700/30',
		violet: 'bg-violet-900/50 text-violet-300 ring-violet-700/30',
	};

	const sizes: Record<string, string> = {
		sm: 'px-2 py-0.5 text-xs',
		md: 'px-2.5 py-1 text-sm',
	};
</script>

<span
	class="inline-flex items-center rounded-full font-medium ring-1 ring-inset
		{styles[variant]} {sizes[size]}"
>
	{@render children()}
</span>
