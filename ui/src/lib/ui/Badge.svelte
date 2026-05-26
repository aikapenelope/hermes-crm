<script lang="ts">
	interface Props {
		variant?: 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'orange' | 'violet';
		size?: 'sm' | 'md';
		children: import('svelte').Snippet;
	}

	let { variant = 'slate', size = 'sm', children }: Props = $props();

	// All variants tuned for dark #070707 background — white/bright for max contrast
	const styles: Record<string, string> = {
		slate:  'border border-[#333] text-[#888]',
		blue:   'border border-white text-white',        // was blue-900/50 — now white
		green:  'border border-emerald-500/60 text-emerald-400',
		amber:  'border border-amber-500/60 text-amber-400',
		red:    'border border-red-500/60 text-red-400',
		orange: 'border border-orange-500/60 text-orange-400',
		violet: 'border border-violet-500/60 text-violet-400',
	};

	const sizes: Record<string, string> = {
		sm: 'px-2 py-0.5 text-[9px] tracking-widest',
		md: 'px-2.5 py-1 text-[10px] tracking-widest',
	};
</script>

<span
	class="inline-flex items-center uppercase font-medium
		{styles[variant]} {sizes[size]}"
>
	{@render children()}
</span>
