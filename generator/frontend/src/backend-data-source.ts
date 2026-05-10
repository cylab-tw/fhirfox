import { attachScenarioResourceMapping } from './resource-mapping.js';
import { hydrateScenarioResultResourceTypes } from './source-resource-bridge.js';

import type {
	BackendDataSourceConfig,
	FhirBundleRecord,
	ScenarioIndexRecord,
	ScenarioResourceMappingRecord,
	ScenarioResultRecord,
	SourceCodeDisplayMap,
	SourceFieldDocRecord,
} from './types.js';
import type { ScenarioBrowserDataSource, ScenarioLoadOptions } from './data-source.js';

interface BackendScenarioResolveResponse {
	generation: {
		id: string;
		scenarioId: string;
		userId: string;
		seed: string;
		requestedAt: string;
		generatedAt: string;
	};
	result: ScenarioResultRecord;
	bundle: FhirBundleRecord;
	mapping: ScenarioResourceMappingRecord;
}

export class BackendScenarioBrowserDataSource implements ScenarioBrowserDataSource {
	private readonly cache = new Map<string, Promise<unknown>>();

	constructor(private readonly config: BackendDataSourceConfig) {}

	loadScenarioIndex(): Promise<ScenarioIndexRecord> {
		return this.readJson(this.toApiUrl('/scenario-index'));
	}

	loadSourceFieldDocs(): Promise<Record<string, SourceFieldDocRecord>> {
		return this.readJson(this.toApiUrl('/source-field-docs'));
	}

	loadSourceCodeDisplayMap(): Promise<SourceCodeDisplayMap> {
		return this.readJson(this.toApiUrl('/source-code-displays'));
	}

	loadScenario(scenarioId: string, options?: ScenarioLoadOptions): Promise<ScenarioResultRecord> {
		return this.loadResolvedScenario(scenarioId, options).then(({ result, mapping }) =>
			attachScenarioResourceMapping(hydrateScenarioResultResourceTypes(result), mapping),
		);
	}

	loadFhirBundle(scenarioId: string, options?: ScenarioLoadOptions): Promise<FhirBundleRecord> {
		return this.loadResolvedScenario(scenarioId, options).then(({ bundle, mapping }) =>
			attachScenarioResourceMapping(bundle, mapping),
		);
	}

	private loadResolvedScenario(
		scenarioId: string,
		options?: ScenarioLoadOptions,
	): Promise<BackendScenarioResolveResponse> {
		const seed = options?.seed ?? this.config.defaultSeed ?? '1234';
		const cacheKey = `${scenarioId}::${seed}`;
		const cached = this.cache.get(cacheKey);

		if (cached) {
			return cached as Promise<BackendScenarioResolveResponse>;
		}

		const request = this.readJson<BackendScenarioResolveResponse>(
			this.toApiUrl(`/scenarios/${encodeURIComponent(scenarioId)}/resolve?seed=${encodeURIComponent(seed)}`),
		);

		this.cache.set(cacheKey, request);
		return request;
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

	private toApiUrl(pathname: string): string {
		return joinUrlPath(normalizeBaseUrl(this.config.apiBaseUrl), pathname);
	}
}

function normalizeBaseUrl(baseUrl: string): string {
	if (!baseUrl || baseUrl === '/') {
		return '/';
	}

	return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

function joinUrlPath(baseUrl: string, pathname: string): string {
	const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;

	if (baseUrl === '/') {
		return normalizedPath;
	}

	return `${baseUrl}${normalizedPath}`;
}
