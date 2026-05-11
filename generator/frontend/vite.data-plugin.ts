import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { buildGeneratedAssets } from './build/generated-assets.js';

import type { AppManifest } from './src/types.js';
import type { GeneratedAssetSet } from './build/types.js';
import type { Plugin } from 'vite';

const VIRTUAL_MODULE_ID = 'virtual:fhirfox-manifest';
const RESOLVED_VIRTUAL_MODULE_ID = '\0virtual:fhirfox-manifest';
const DATA_BASE_URL = '/data';

export interface FhirfoxDataPluginOptions {
	deploymentMode?: 'static' | 'backend';
	backendApiBaseUrl?: string;
	backendProxyTarget?: string;
	defaultSeed?: string;
}

export function fhirfoxDataPlugin(options: FhirfoxDataPluginOptions = {}): Plugin {
	const frontendRoot = path.dirname(fileURLToPath(import.meta.url));
	const generatorRoot = path.resolve(frontendRoot, '..');
	const repoRoot = path.resolve(generatorRoot, '..');
	const datasetRoot = path.join(repoRoot, 'dataset');
	let appBaseUrl = '/';
	let deploymentMode: 'static' | 'backend' = options.deploymentMode ?? 'static';
	let backendApiBaseUrl = normalizeBackendApiBaseUrl(options.backendApiBaseUrl ?? '/api');
	let defaultSeed = options.defaultSeed ?? '1234';
	let cachedAssets: Promise<GeneratedAssetSet> | null = null;
	let cachedManifest: AppManifest | null = null;

	function invalidateAssets() {
		cachedAssets = null;
		cachedManifest = null;
	}

	function getAssets(): Promise<GeneratedAssetSet> {
		cachedAssets ??= buildGeneratedAssets(datasetRoot, appBaseUrl, defaultSeed);
		return cachedAssets;
	}

	function getManifest(): Promise<AppManifest> {
		if (deploymentMode === 'backend') {
			cachedManifest ??= {
				generatedAt: new Date().toISOString(),
				dataSource: {
					kind: 'backend',
					apiBaseUrl: backendApiBaseUrl,
					defaultSeed,
				},
			};
			return Promise.resolve(cachedManifest);
		}

		return getAssets().then(({ manifest }) => manifest);
	}

	return {
		name: 'fhirfox-data',
		configResolved(config) {
			appBaseUrl = normalizeBaseUrl(config.base);
			deploymentMode = normalizeDeploymentMode(options.deploymentMode ?? process.env.FHIRFOX_DEPLOYMENT_MODE);
			backendApiBaseUrl = normalizeBackendApiBaseUrl(
				options.backendApiBaseUrl ?? process.env.FHIRFOX_BACKEND_API_BASE_URL ?? '/api',
			);
			defaultSeed = options.defaultSeed ?? process.env.FHIRFOX_DEFAULT_SEED ?? '1234';
			invalidateAssets();
		},
		resolveId(id) {
			if (id === VIRTUAL_MODULE_ID) {
				return RESOLVED_VIRTUAL_MODULE_ID;
			}
		},
		async load(id) {
			if (id !== RESOLVED_VIRTUAL_MODULE_ID) {
				return null;
			}

			const manifest = await getManifest();
			return `export const manifest = ${JSON.stringify(manifest)}; export default manifest;`;
		},
		configureServer(server) {
			if (deploymentMode !== 'static') {
				return;
			}

			server.watcher.add(datasetRoot);
			server.middlewares.use(async (req, res, next) => {
				const requestUrl = stripBasePath(req.url?.split('?', 1)[0], appBaseUrl);

				if (!requestUrl?.startsWith(`${DATA_BASE_URL}/`)) {
					next();
					return;
				}

				try {
					const { assets } = await getAssets();
					const asset = assets.get(requestUrl);

					if (!asset) {
						next();
						return;
					}

					res.setHeader('Content-Type', 'application/json; charset=utf-8');
					res.end(asset);
				} catch (error) {
					next(error instanceof Error ? error : new Error('Failed to serve generated app data.'));
				}
			});
		},
		handleHotUpdate(context) {
			if (deploymentMode !== 'static') {
				return;
			}

			if (!context.file.startsWith(datasetRoot)) {
				return;
			}

			invalidateAssets();
			const module = context.server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID);

			if (module) {
				context.server.moduleGraph.invalidateModule(module);
			}

			context.server.ws.send({ type: 'full-reload' });
			return [];
		},
		async generateBundle() {
			if (deploymentMode !== 'static') {
				return;
			}

			const { assets } = await getAssets();

			for (const [assetPath, source] of assets) {
				this.emitFile({
					type: 'asset',
					fileName: assetPath.replace(/^\//u, ''),
					source,
				});
			}
		},
	};
}

function normalizeBaseUrl(baseUrl: string): string {
	if (!baseUrl || baseUrl === '/') {
		return '/';
	}

	const trimmed = baseUrl.trim().replace(/^\/+|\/+$/gu, '');
	return trimmed ? `/${trimmed}/` : '/';
}

function normalizeBackendApiBaseUrl(baseUrl: string): string {
	const normalized = baseUrl.trim();
	if (!normalized || normalized === '/') {
		return '/api';
	}
	return normalized.startsWith('/') ? normalized.replace(/\/+$/u, '') : `/${normalized.replace(/\/+$/u, '')}`;
}

function normalizeDeploymentMode(value: string | undefined): 'static' | 'backend' {
	return value === 'backend' ? 'backend' : 'static';
}

function stripBasePath(requestPath: string | undefined, baseUrl: string): string | undefined {
	if (!requestPath || baseUrl === '/') {
		return requestPath;
	}

	return requestPath.startsWith(baseUrl) ? requestPath.slice(baseUrl.length - 1) || '/' : requestPath;
}
