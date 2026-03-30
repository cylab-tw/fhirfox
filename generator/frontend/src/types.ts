import type { FhirBundle, SourceResource } from '@fhirfox/converter/browser';
import type {
	AppManifest as SharedAppManifest,
	ScenarioIndexRecord as SharedScenarioIndexRecord,
	ScenarioLevelDefinition as SharedScenarioLevelDefinition,
	ScenarioRecord as SharedScenarioRecord,
	ScenarioResourceMappingRecord as SharedScenarioResourceMappingRecord,
	ScenarioResultRecord as SharedScenarioResultRecord,
	SourceCodeDisplayMap as SharedSourceCodeDisplayMap,
	SourceFieldDocRecord as SharedSourceFieldDocRecord,
	StaticAssetDataSourceConfig as SharedStaticAssetDataSourceConfig,
} from './contracts.js';

export type OutputTab = 'simplified' | 'fhir';
export type PreviewMode = 'document' | 'resource';
export type ResourceJumpScrollBehavior = 'smooth' | 'auto';

export interface ResourceJumpTarget {
	resourceType: string;
	nonce: number;
	ordinal: number;
	sourceKey?: string;
}

export interface ViewContext {
	activeTab: OutputTab;
	previewMode: PreviewMode;
}

export interface ResourceJumpContext extends ViewContext {
	epoch: number;
}

export interface ResourceLinkRecord {
	sourceType: string;
	field: string;
	targetTypes: string[];
}

export type SourceResourceRecord = SourceResource;

export type ScenarioRecord = SharedScenarioRecord;

export interface ScenarioResultRecord extends SharedScenarioResultRecord {
	resources: Record<string, SourceResourceRecord[]>;
	orderedResources: SourceResourceRecord[];
}

export type FhirBundleRecord = FhirBundle;

export type ScenarioResourceMappingRecord = SharedScenarioResourceMappingRecord;

export type ScenarioIndexRecord = SharedScenarioIndexRecord & {
	scenarios: ScenarioRecord[];
};

export type ScenarioLevelDefinition = SharedScenarioLevelDefinition;
export type StaticAssetDataSourceConfig = SharedStaticAssetDataSourceConfig;
export type AppManifest = SharedAppManifest;

export interface PreviewResourceItem {
	id: string;
	resourceType: string;
	sourceKey: string;
	title: string;
	subtitle?: string;
	resource: Record<string, unknown>;
}

export type SourceFieldDocRecord = SharedSourceFieldDocRecord;

export type SourceCodeDisplayMap = SharedSourceCodeDisplayMap;
