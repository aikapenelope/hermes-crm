import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],

	build: {
		// Target modern browsers — skip polyfills for arrow functions,
		// optional chaining, etc. Reduces bundle size.
		target: ['es2020', 'chrome90', 'firefox90', 'safari14'],

		// Inline small assets (< 2KB) into CSS/JS
		assetsInlineLimit: 2048,

		rollupOptions: {
			output: {
				// Split vendor chunks so lucide-svelte (large icon library)
				// and pocketbase SDK are cached separately from app code.
				// When only a component changes, browser re-downloads only that chunk.
				manualChunks(id) {
					if (id.includes('lucide-svelte') || id.includes('/lucide/')) {
						return 'vendor-icons';
					}
					if (id.includes('pocketbase')) {
						return 'vendor-pb';
					}
					if (id.includes('node_modules')) {
						return 'vendor';
					}
				},
			},
		},
	},
});
