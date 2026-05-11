import type { FhirBundle, SourceResource } from '@fhirfox/converter/browser';
import type { ResourceRelationGraph } from '@fhirfox-generator/dataset';

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

export interface ScenarioIndexRecord {
	generatedAt: string;
	scenarioSource: 'authored' | 'backend' | 'missing';
	levelDefinitions: ScenarioLevelDefinition[];
	scenarios: ScenarioRecord[];
}

export interface ScenarioResourceMappingRecord {
	orderedSourceKeys: string[];
	bundleEntrySourceKeys: string[];
}

export interface ScenarioResultRecord {
	scenarioId: string;
	resources: Record<string, SourceResource[]>;
	orderedResources: SourceResource[];
	graph: ResourceRelationGraph;
	warnings?: string[];
	meta: {
		directMatchCount: number;
		expandedMatchCount: number;
		totalResources: number;
	};
}

export interface FhirBundleRecord {
	resourceType: 'Bundle';
	type: string;
	entry: Array<{ resource: Record<string, unknown> }>;
}

export type FhirBundleShape = FhirBundle;

export interface ResolvedScenarioResponse {
	generation: GenerationRecord;
	result: ScenarioResultRecord;
	bundle: FhirBundleRecord;
	mapping: ScenarioResourceMappingRecord;
}

export interface BackendManifest {
	generatedAt: string;
	dataSource: BackendDataSourceConfig;
}

export interface BackendDataSourceConfig {
	kind: 'backend';
	apiBaseUrl: string;
	defaultSeed?: string;
}

export interface StaticAssetDataSourceConfig {
	kind: 'generated-asset';
	scenarioIndexUrl: string;
	sourceFieldDocsUrl: string;
	sourceCodeDisplayMapUrl: string;
	scenarioAssetBaseUrl: string;
}

export type AppDataSourceConfig = BackendDataSourceConfig | StaticAssetDataSourceConfig;

export interface UserRecord {
	id: string;
	createdAt: string;
	lastLoginAt?: string;
	displayName?: string;
}

export interface GenerationRecord {
	id: string;
	scenarioId: string;
	userId: string;
	seed: string;
	requestedAt: string;
	generatedAt: string;
}

export interface BackendState {
	users: UserRecord[];
	generations: GenerationRecord[];
}

export interface ScenarioResolutionRequest {
	seed?: string;
}
