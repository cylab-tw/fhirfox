import type { SourceResource } from '@fhirfox/converter/browser';

export type ScenarioLevel = number;

export interface ScenarioLevelDefinition {
	level: ScenarioLevel;
	label: string;
	title: string;
	englishTitle?: string;
	description?: string;
}

export interface SourceFieldDocRecord {
	description?: string;
	cardinality?: string;
	required?: boolean;
	fhirMapping?: string;
	reference?: string | string[];
}

export type SourceCodeDisplayMap = Record<string, string>;

export interface ScenarioRecord {
	id: string;
	displayName: string;
	type: string;
	summary?: string;
	details?: string;
	level?: ScenarioLevel;
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
