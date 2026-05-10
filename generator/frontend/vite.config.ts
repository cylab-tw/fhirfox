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
	const deploymentMode = env.FHIRFOX_DEPLOYMENT_MODE === 'backend' ? 'backend' : 'static';
	const backendProxyTarget = env.FHIRFOX_BACKEND_PROXY_TARGET?.trim();

	return {
		base: normalizeBasePath(env.FHIRFOX_BASE_PATH),
		server:
			deploymentMode === 'backend' && backendProxyTarget
				? {
						proxy: {
							'/api': {
								target: backendProxyTarget,
								changeOrigin: true,
							},
						},
					}
				: undefined,
		resolve: {
			alias: {
				'@fhirfox-generator/dataset/source': fileURLToPath(new URL('../dataset/src/source.ts', import.meta.url)),
				'@fhirfox-generator/dataset': fileURLToPath(new URL('../dataset/src/index.ts', import.meta.url)),
				'@fhirfox/converter/browser': fileURLToPath(new URL('../converter/src/browser.ts', import.meta.url)),
			},
		},
		plugins: [
			react(),
			tailwindcss(),
			fhirfoxDataPlugin({
				deploymentMode,
				backendApiBaseUrl: env.FHIRFOX_BACKEND_API_BASE_URL,
				backendProxyTarget,
				defaultSeed: env.FHIRFOX_DEFAULT_SEED,
			}),
		],
	};
});
