import type {
	AppManifest,
	ScenarioIndexRecord,
	ScenarioLevel,
	ScenarioLevelDefinition,
	ScenarioRecord,
	ScenarioResourceMappingRecord,
	ScenarioResultRecord,
	SourceCodeDisplayMap,
	SourceFieldDocRecord,
} from '../src/contracts.js';
import type { IndexedResource as FrontendIndexedResource } from '../src/source-resource-bridge.js';
import type { SourceResource } from '../../converter/src/browser.ts';

export type {
	AppManifest,
	ScenarioIndexRecord,
	ScenarioLevel,
	ScenarioLevelDefinition,
	ScenarioResourceMappingRecord,
	ScenarioRecord,
	ScenarioResultRecord,
	SourceResource,
	SourceCodeDisplayMap,
	SourceFieldDocRecord,
};

export interface ResourceLink {
	sourceType: string;
	field: string;
	targetTypes: string[];
}

export type IndexedResource = FrontendIndexedResource & { __sourceRecord: SourceResource };

export interface GeneratedAssetSet {
	manifest: AppManifest;
	assets: Map<string, string>;
}
