import type { Dataset, Resource, ResourceLinks, ResourceType } from '../resources/index.js';

/**
 * Loads source resources from a backing dataset.
 *
 * Providers are storage-facing only. They return source-side records for one
 * resource type and expose the declared source-data links for the dataset they
 * serve, while scenario interpretation belongs to the scenario layer.
 */
export interface DatasetProvider {
	/**
	 * Returns resources of the given type that exactly match every provided
	 * filter field.
	 *
	 * Filter semantics:
	 * - flat equality only
	 * - all fields are combined with AND
	 * - `id`, `type`, and other top-level resource fields are all valid filters
	 * - filters are intended for scalar exact matches rather than array
	 *   containment checks
	 */
	queryResources(resourceType: ResourceType, filter?: Dataset): Promise<Resource[]>;

	/**
	 * Returns the declared source-data links available for scenario resolution.
	 */
	listResourceLinks(): Promise<ResourceLinks> | ResourceLinks;

	/**
	 * Returns source resources whose `field` links to the given target resource id.
	 *
	 * Providers may optimize this differently from `queryResources`, especially
	 * for database-backed implementations and array-valued link fields.
	 */
	queryLinkedResources(resourceType: ResourceType, field: string, targetId: string): Promise<Resource[]>;
}
