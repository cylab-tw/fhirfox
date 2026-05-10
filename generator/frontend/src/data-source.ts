import type {
	FhirBundleRecord,
	ScenarioIndexRecord,
	ScenarioResultRecord,
	SourceCodeDisplayMap,
	SourceFieldDocRecord,
} from './types.js';

export interface ScenarioBrowserDataSource {
	loadScenarioIndex(): Promise<ScenarioIndexRecord>;
	loadSourceFieldDocs(): Promise<Record<string, SourceFieldDocRecord>>;
	loadSourceCodeDisplayMap(): Promise<SourceCodeDisplayMap>;
	loadScenario(scenarioId: string, options?: ScenarioLoadOptions): Promise<ScenarioResultRecord>;
	loadFhirBundle(scenarioId: string, options?: ScenarioLoadOptions): Promise<FhirBundleRecord>;
}

export interface ScenarioLoadOptions {
	seed?: string | null;
}
