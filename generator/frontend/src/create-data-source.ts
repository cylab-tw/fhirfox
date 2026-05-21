import { BackendScenarioBrowserDataSource } from './backend-data-source.js';
import { GeneratedAssetScenarioBrowserDataSource } from './generated-asset-data-source.js';

import type { AppManifest } from './types.js';
import type { ScenarioBrowserDataSource } from './data-source.js';

export function createScenarioBrowserDataSource(manifest: AppManifest): ScenarioBrowserDataSource {
	switch (manifest.dataSource.kind) {
		case 'generated-asset':
			return new GeneratedAssetScenarioBrowserDataSource(manifest.dataSource);
		case 'backend':
			return new BackendScenarioBrowserDataSource(manifest.dataSource);
		default:
			return throwUnsupportedDataSource(manifest.dataSource);
	}
}

function throwUnsupportedDataSource(value: unknown): never {
	throw new Error(`Unsupported scenario browser data source: ${JSON.stringify(value)}`);
}
