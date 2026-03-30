import { attachScenarioResourceMapping } from './resource-mapping.js';
import { hydrateScenarioResultResourceTypes } from './source-resource-bridge.js';

import type {
	FhirBundleRecord,
	ScenarioIndexRecord,
	ScenarioResourceMappingRecord,
	ScenarioResultRecord,
	SourceCodeDisplayMap,
	SourceFieldDocRecord,
	StaticAssetDataSourceConfig,
} from './types.js';
import type { ScenarioBrowserDataSource } from './data-source.js';

export class GeneratedAssetScenarioBrowserDataSource implements ScenarioBrowserDataSource {
	private readonly cache = new Map<string, Promise<unknown>>();

	constructor(private readonly config: StaticAssetDataSourceConfig) {}

	loadScenarioIndex(): Promise<ScenarioIndexRecord> {
		return this.readJson(this.config.scenarioIndexUrl);
	}

	loadSourceFieldDocs(): Promise<Record<string, SourceFieldDocRecord>> {
		return this.readJson(this.config.sourceFieldDocsUrl);
	}

	loadSourceCodeDisplayMap(): Promise<SourceCodeDisplayMap> {
		return this.readJson(this.config.sourceCodeDisplayMapUrl);
	}

	loadScenario(scenarioId: string): Promise<ScenarioResultRecord> {
		return Promise.all([
			this.readJson<ScenarioResultRecord>(this.toScenarioAssetUrl(scenarioId, 'source.json')),
			this.readJson<ScenarioResourceMappingRecord>(this.toScenarioAssetUrl(scenarioId, 'mapping.json')),
		]).then(([result, mapping]) => attachScenarioResourceMapping(hydrateScenarioResultResourceTypes(result), mapping));
	}

	loadFhirBundle(scenarioId: string): Promise<FhirBundleRecord> {
		return Promise.all([
			this.readJson<FhirBundleRecord>(this.toScenarioAssetUrl(scenarioId, 'bundle.json')),
			this.readJson<ScenarioResourceMappingRecord>(this.toScenarioAssetUrl(scenarioId, 'mapping.json')),
		]).then(([bundle, mapping]) => attachScenarioResourceMapping(bundle, mapping));
	}

	private readJson<T>(url: string): Promise<T> {
		const cached = this.cache.get(url);

		if (cached) {
			return cached as Promise<T>;
		}

		const request = fetch(url).then(async (response) => {
			if (!response.ok) {
				throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
			}

			return (await response.json()) as T;
		});

		this.cache.set(url, request);
		return request;
	}

	private toScenarioAssetUrl(scenarioId: string, filename: 'source.json' | 'bundle.json' | 'mapping.json'): string {
		return `${this.config.scenarioAssetBaseUrl}/${encodeURIComponent(scenarioId)}/${filename}`;
	}
}
