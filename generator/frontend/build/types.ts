import type {
	AppManifest,
	ScenarioIndexRecord,
	ScenarioLevel,
	ScenarioRecord,
	ScenarioResourceMappingRecord,
	ScenarioResultRecord,
	SourceCodeDisplayMap,
	SourceFieldDocRecord,
} from '../src/contracts.js';
import type { ResourceLink as DatasetResourceLink, Resource } from '../../dataset/src/index.ts';
import type { SourceResource } from '@fhirfox/converter/browser';

export type {
	AppManifest,
	ScenarioIndexRecord,
	DatasetResourceLink as ResourceLink,
	ScenarioLevel,
	ScenarioResourceMappingRecord,
	ScenarioRecord,
	ScenarioResultRecord,
	SourceCodeDisplayMap,
	SourceFieldDocRecord,
};

export interface IndexedResource extends Resource {
	__sourceRecord: SourceResource;
	__resourceType: string;
}

export interface GeneratedAssetSet {
	manifest: AppManifest;
	assets: Map<string, string>;
}
