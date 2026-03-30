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
	loadScenario(scenarioId: string): Promise<ScenarioResultRecord>;
	loadFhirBundle(scenarioId: string): Promise<FhirBundleRecord>;
}
