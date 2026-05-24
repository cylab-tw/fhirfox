import type { CodeMappingDefinition, ResourceTypeDefinition, SourceResource } from '#/model/index.js';
import type { DatasetProvider } from './types.js';
import type { Preset } from '#/preset/index.js';

/** Provider input backed by already-loaded JavaScript values. */
export interface InMemoryDatasetProviderInput {
	resourceTypeDefinitions: ResourceTypeDefinition[];
	presets: Preset[];
	resources?: Record<string, SourceResource[]>;
	codeMappings?: CodeMappingDefinition[];
}

/** Creates a provider for tests, static builds, and small tools. */
export function createInMemoryDatasetProvider(input: InMemoryDatasetProviderInput): DatasetProvider {
	return {
		async getResourceTypeDefinitions() {
			return input.resourceTypeDefinitions;
		},
		async getPresets() {
			return input.presets;
		},
		async queryResources(resourceType, filter) {
			const resources = input.resources?.[resourceType] ?? [];
			return filter ? resources.filter((resource) => matches(resource, filter)) : resources;
		},
		async getCodeMappings() {
			return input.codeMappings ?? [];
		},
	};
}

function matches(resource: SourceResource, filter: Record<string, unknown>): boolean {
	return Object.entries(filter).every(([field, expected]) => {
		const actual = resource[field];

		if (typeof expected === 'object' && expected !== null && !Array.isArray(expected)) {
			return matchesRange(actual, expected as Record<string, unknown>);
		}

		return actual === expected;
	});
}

function matchesRange(actual: unknown, expected: Record<string, unknown>): boolean {
	if (typeof actual !== 'number') {
		return false;
	}

	return (
		(!('gt' in expected) || actual > Number(expected.gt)) &&
		(!('gte' in expected) || actual >= Number(expected.gte)) &&
		(!('lt' in expected) || actual < Number(expected.lt)) &&
		(!('lte' in expected) || actual <= Number(expected.lte))
	);
}
