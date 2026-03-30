import { readSourceResourceType } from '@fhirfox/converter/browser';

import type {
	FhirBundleRecord,
	ScenarioResourceMappingRecord,
	ScenarioResultRecord,
	SourceResourceRecord,
} from './types.js';

export function createSourceResourceKey(resource: SourceResourceRecord, index: number): string {
	return createResourceKey(readSourceResourceType(resource), resource.id, index);
}

export function createFhirResourceKey(resource: Record<string, unknown>, index: number): string {
	const resourceType = typeof resource.resourceType === 'string' ? resource.resourceType : 'Resource';
	return createResourceKey(resourceType, resource.id, index);
}

export function attachScenarioResourceMapping<T extends object>(target: T, mapping: ScenarioResourceMappingRecord): T {
	Object.defineProperty(target, '__resourceMapping', {
		value: mapping,
		enumerable: false,
		configurable: true,
		writable: false,
	});

	return target;
}

export function readScenarioResourceMapping(target: unknown): ScenarioResourceMappingRecord | null {
	if (!isRecord(target)) {
		return null;
	}

	return '__resourceMapping' in target && isScenarioResourceMappingRecord(target.__resourceMapping)
		? target.__resourceMapping
		: null;
}

export function getOrderedSourceKeys(result: ScenarioResultRecord): string[] {
	const mapping = readScenarioResourceMapping(result);

	return (
		mapping?.orderedSourceKeys ??
		result.orderedResources.map((resource, index) => createSourceResourceKey(resource, index))
	);
}

export function getBundleEntrySourceKeys(bundle: FhirBundleRecord): string[] {
	const mapping = readScenarioResourceMapping(bundle);

	return (
		mapping?.bundleEntrySourceKeys ?? bundle.entry.map((entry, index) => createFhirResourceKey(entry.resource, index))
	);
}

function createResourceKey(resourceType: unknown, id: unknown, index: number): string {
	const normalizedType =
		typeof resourceType === 'string' && resourceType.length > 0 ? resourceType.toLowerCase() : 'resource';
	const normalizedId = typeof id === 'string' && id.length > 0 ? id : `index-${index + 1}`;

	return `${normalizedType}/${normalizedId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isScenarioResourceMappingRecord(value: unknown): value is ScenarioResourceMappingRecord {
	if (!isRecord(value)) {
		return false;
	}

	return (
		Array.isArray(value.orderedSourceKeys) &&
		value.orderedSourceKeys.every((entry) => typeof entry === 'string') &&
		Array.isArray(value.bundleEntrySourceKeys) &&
		value.bundleEntrySourceKeys.every((entry) => typeof entry === 'string')
	);
}
