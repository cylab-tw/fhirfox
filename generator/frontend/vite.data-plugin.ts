import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { buildGeneratedAssets } from './build/generated-assets.js';

import type { GeneratedAssetSet } from './build/types.js';
import type { Plugin } from 'vite';

const VIRTUAL_MODULE_ID = 'virtual:fhirfox-manifest';
const RESOLVED_VIRTUAL_MODULE_ID = '\0virtual:fhirfox-manifest';
const DATA_BASE_URL = '/data';

export function fhirfoxDataPlugin(): Plugin {
	const frontendRoot = path.dirname(fileURLToPath(import.meta.url));
	const generatorRoot = path.resolve(frontendRoot, '..');
	const repoRoot = path.resolve(generatorRoot, '..');
	const datasetRoot = path.join(repoRoot, 'dataset');
	const scenariosRoot = path.join(repoRoot, 'scenarios');
	let appBaseUrl = '/';
	let cachedAssets: Promise<GeneratedAssetSet> | null = null;

	function invalidateAssets() {
		cachedAssets = null;
	}

	function getAssets(): Promise<GeneratedAssetSet> {
		cachedAssets ??= buildGeneratedAssets(datasetRoot, scenariosRoot, appBaseUrl);
		return cachedAssets;
	}

	return {
		name: 'fhirfox-data',
		configResolved(config) {
			appBaseUrl = normalizeBaseUrl(config.base);
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

			const { manifest } = await getAssets();
			return `export const manifest = ${JSON.stringify(manifest)}; export default manifest;`;
		},
		configureServer(server) {
			server.watcher.add(datasetRoot);
			server.watcher.add(scenariosRoot);
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
			if (!context.file.startsWith(datasetRoot) && !context.file.startsWith(scenariosRoot)) {
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

function stripBasePath(requestPath: string | undefined, baseUrl: string): string | undefined {
	if (!requestPath || baseUrl === '/') {
		return requestPath;
	}

	return requestPath.startsWith(baseUrl) ? requestPath.slice(baseUrl.length - 1) || '/' : requestPath;
}
