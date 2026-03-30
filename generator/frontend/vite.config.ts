import { defineConfig, loadEnv } from 'vite';
import { fhirfoxDataPlugin } from './vite.data-plugin.js';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function normalizeBasePath(basePath: string | undefined): string {
	if (!basePath || basePath === '/') {
		return '/';
	}

	const trimmed = basePath.trim().replace(/^\/+|\/+$/gu, '');
	return trimmed ? `/${trimmed}/` : '/';
}

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');

	return {
		base: normalizeBasePath(env.FHIRFOX_BASE_PATH),
		resolve: {
			alias: {
				'@fhirfox/dataset/source': fileURLToPath(new URL('../dataset/src/source.ts', import.meta.url)),
				'@fhirfox/dataset': fileURLToPath(new URL('../dataset/src/index.ts', import.meta.url)),
				'@fhirfox/converter/browser': fileURLToPath(new URL('../converter/dist/browser.js', import.meta.url)),
			},
		},
		plugins: [react(), tailwindcss(), fhirfoxDataPlugin()],
	};
});
