import type {
	SourceFieldDocRecord as DatasetSourceFieldDocRecord,
	ScenarioLevelDefinition,
	ScenarioMetadata,
} from '@fhirfox/dataset/source';
export type { ScenarioLevel } from '@fhirfox/dataset/source';
export type { ScenarioLevelDefinition } from '@fhirfox/dataset/source';
import type { SourceResource } from '@fhirfox/converter/browser';

export type SourceFieldDocRecord = DatasetSourceFieldDocRecord;
export type SourceCodeDisplayMap = Record<string, string>;

export interface ScenarioRecord extends ScenarioMetadata {
	resources: Record<string, Record<string, unknown> | Array<Record<string, unknown>>>;
}

export interface ScenarioResultRecord {
	scenarioId: string;
	resources: Record<string, SourceResource[]>;
	orderedResources: SourceResource[];
	warnings?: string[];
	meta: {
		directMatchCount: number;
		expandedMatchCount: number;
		totalResources: number;
	};
}

export interface ScenarioResourceMappingRecord {
	orderedSourceKeys: string[];
	bundleEntrySourceKeys: string[];
}

export interface ScenarioIndexRecord {
	generatedAt: string;
	scenarioSource: 'authored' | 'missing';
	levelDefinitions: ScenarioLevelDefinition[];
	scenarios: ScenarioRecord[];
}

export interface StaticAssetDataSourceConfig {
	kind: 'generated-asset';
	scenarioIndexUrl: string;
	sourceFieldDocsUrl: string;
	sourceCodeDisplayMapUrl: string;
	scenarioAssetBaseUrl: string;
}

export type AppDataSourceConfig = StaticAssetDataSourceConfig;

export interface AppManifest {
	generatedAt: string;
	dataSource: AppDataSourceConfig;
}
