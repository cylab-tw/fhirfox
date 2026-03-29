import type { ResourceType } from './resource.js';

/**
 * One declared source-data link from a source resource field to one or more
 * allowed target types.
 *
 * This describes a foreign-key-like relationship in the source dataset. The
 * value at `field` is interpreted as the id of a related target resource when
 * present.
 */
export interface ResourceLink {
	sourceType: ResourceType;
	field: string;
	targetTypes: ResourceType[];
}

/**
 * Flat list of declared source-data links available to scenario resolution.
 *
 * Keeping the links flat avoids over-modeling at this stage; resolution code
 * can group or index them at runtime if needed.
 *
 * Example:
 * [
 *   { sourceType: 'encounter', field: 'patient_id', targetTypes: ['patient'] },
 *   { sourceType: 'observation', field: 'performerId', targetTypes: ['patient', 'practitioner'] },
 * ]
 */
export type ResourceLinks = ResourceLink[];
