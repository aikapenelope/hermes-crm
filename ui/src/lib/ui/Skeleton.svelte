<script lang="ts">
	interface Props {
		rows?: number;
		class?: string;
	}

	let { rows = 5, class: extraClass = '' }: Props = $props();
</script>

<div class="space-y-3 {extraClass}" aria-busy="true" aria-label="Cargando…">
	{#each Array(rows) as _, i}
		<div class="flex items-center gap-3">
			<div class="skeleton h-8 w-8 shrink-0 rounded-full"></div>
			<div class="flex-1 space-y-1.5">
				<div class="skeleton h-3.5 rounded" style="width: {60 + (i % 3) * 15}%"></div>
				<div class="skeleton h-3 rounded" style="width: {30 + (i % 4) * 10}%"></div>
			</div>
		</div>
	{/each}
</div>
