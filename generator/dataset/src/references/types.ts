import type { SourceResource } from '#/model/index.js';

/** Parsed minimum and maximum count for a reference selection. */
export type Cardinality = {
	min: number;
	max: number | 'many';
};

interface ReferenceSelectionBase {
	/** Expected number of target ids, such as `1..1` or `0..*`. */
	cardinality?: string;
	/** Provider query used when selecting existing records. */
	select?: Record<string, unknown>;
	/** How to choose from matching provider records. */
	strategy?: 'first' | 'one' | 'sample';
	/** Keep provider order instead of sorting matches before selection. */
	preserveSelectionOrder?: boolean;
}

/** Reference form that points at another scenario resource by alias. */
export type AliasReference = ReferenceSelectionBase & {
	alias: string;
};

/** Reference form that selects existing records from the provider. */
export type ReferenceSelection = ReferenceSelectionBase & {
	resourceType: string;
};

/** Reference authoring value for one field. */
export type ReferenceSpec = string | AliasReference | ReferenceSelection;

/** Reference targets after alias lookup or provider selection. */
export interface ResolvedReference {
	/** Field being filled on the source record. */
	field: string;
	/** Graph keys for the referenced records. */
	targetKeys: string[];
	/** Id values written into the source field. */
	targetIds: string[];
	cardinality: string;
	targetResourceType?: string;
	typeField?: string;
	typeValue?: string;
	selectedResources?: Array<{
		key: string;
		resourceType: string;
		resource: SourceResource;
	}>;
}
