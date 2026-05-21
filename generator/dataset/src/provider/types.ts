import type { ResourceTypeDefinition, SourceResource } from '#/model/index.js';
import type { Preset } from '#/preset/index.js';

/** Source of resource definitions, presets, and existing records for resolution. */
export interface DatasetProvider {
	/** Load the resource types the generator can emit. */
	getResourceTypeDefinitions(): Promise<ResourceTypeDefinition[]>;
	/** Load reusable field patches for resource types. */
	getPresets(): Promise<Preset[]>;
	/** Find existing source records that can satisfy a reference selection. */
	queryResources(resourceType: string, filter?: Record<string, unknown>): Promise<SourceResource[]>;
}
