import {
	attachInternalSourceResourceType,
	normalizeSourceResourceType,
	readSourceResourceType,
} from '@fhirfox/converter/browser';

import type { ScenarioResultRecord, SourceResourceRecord } from './types.js';
import type { Resource } from '@fhirfox/dataset';

export interface IndexedResource extends Resource {
	__sourceRecord: SourceResourceRecord;
	__resourceType: string;
}

export function toIndexedResource(resource: SourceResourceRecord): IndexedResource {
	const resourceType = readSourceResourceType(resource);
	const indexedResource = {
		...resource,
		type: resourceType,
		__resourceType: resourceType,
	} as IndexedResource;

	Object.defineProperty(indexedResource, '__sourceRecord', {
		value: resource,
		enumerable: false,
		configurable: true,
		writable: false,
	});

	return indexedResource;
}

export function toSourceResourceRecord(resource: Resource): SourceResourceRecord {
	const indexedResource = resource as Partial<IndexedResource>;

	if ('__sourceRecord' in indexedResource && indexedResource.__sourceRecord) {
		return attachInternalSourceResourceType(
			normalizeSourceResourceType({ ...indexedResource.__sourceRecord }),
			readSourceResourceType(indexedResource.__sourceRecord),
		);
	}

	const { __resourceType, type, ...rest } = resource as Resource & {
		__resourceType?: unknown;
		resourceType?: unknown;
	};
	const normalized = normalizeSourceResourceType({
		...rest,
		...(typeof __resourceType === 'string' ? { resourceType: __resourceType } : {}),
	} as SourceResourceRecord);
	return attachInternalSourceResourceType(
		normalized,
		typeof type === 'string' && type.length > 0 ? type : readSourceResourceType(normalized),
	);
}

export function hydrateScenarioResultResourceTypes(result: ScenarioResultRecord): ScenarioResultRecord {
	const groupedResources = Object.fromEntries(
		Object.entries(result.resources).map(([resourceType, resources]) => [
			resourceType,
			resources.map((resource) => attachInternalSourceResourceType({ ...resource }, resourceType)),
		]),
	) as Record<string, SourceResourceRecord[]>;

	const resourcesBySignature = new Map<string, SourceResourceRecord[]>();

	for (const resources of Object.values(groupedResources)) {
		for (const resource of resources) {
			const signature = JSON.stringify(resource);
			const matches = resourcesBySignature.get(signature) ?? [];
			matches.push(resource);
			resourcesBySignature.set(signature, matches);
		}
	}

	const orderedResources = result.orderedResources.map((resource) => {
		const signature = JSON.stringify(resource);
		const matches = resourcesBySignature.get(signature);

		if (!matches || matches.length === 0) {
			throw new Error(`Source resource ${resource.id} is missing an internal resource selector.`);
		}

		const match = matches.shift();

		if (!match) {
			throw new Error(`Source resource ${resource.id} is missing an internal resource selector.`);
		}

		return match;
	});

	return {
		...result,
		resources: groupedResources,
		orderedResources,
	};
}
