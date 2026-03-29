/**
 * Raw source data shaped like records from hospital systems.
 *
 * The dataset package models and selects these source-side records before any
 * later conversion into FHIR JSON.
 */
export type Dataset = Record<string, unknown>;

/**
 * Source resource type in the dataset package.
 *
 * This stays open for now because the supported source resource kinds are
 * expected to come from static dataset assets rather than a fixed TypeScript
 * enum maintained here.
 */
export type ResourceType = string;

/**
 * One source-side resource that scenarios can select and relate to other
 * resources through declared links.
 */
export type Resource = Dataset & {
	id: string;
	type: ResourceType;
};
