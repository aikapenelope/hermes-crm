import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// adapter-static with fallback → pure SPA, no SSR.
		// PocketBase serves index.html for every non-asset request.
		adapter: adapter({
			fallback: 'index.html',
		}),
	},
};

export default config;
