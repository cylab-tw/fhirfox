import type { SourceResource } from './types.js';

export function readSourceResourceType(
	resource: Partial<Pick<SourceResource, 'id' | '__resourceType' | 'resourceType'>>,
): string {
	const resourceType = readString(resource.__resourceType) ?? readString(resource.resourceType);

	if (!resourceType) {
		throw new Error(
			`Source resource ${typeof resource.id === 'string' && resource.id.length > 0 ? resource.id : '(unknown)'} is missing an internal resource selector.`,
		);
	}

	return resourceType;
}

export function readNormalizedSourceResourceType(
	resource: Partial<Pick<SourceResource, 'id' | '__resourceType' | 'resourceType'>>,
): string {
	return readSourceResourceType(resource).toLowerCase();
}

export function attachInternalSourceResourceType<TResource extends object>(
	resource: TResource,
	resourceType: string,
): TResource & { __resourceType: string } {
	Object.defineProperty(resource, '__resourceType', {
		value: resourceType,
		enumerable: false,
		configurable: true,
		writable: true,
	});

	return resource as TResource & { __resourceType: string };
}

export function normalizeSourceResourceType<TResource extends SourceResource>(resource: TResource): TResource {
	if (readString(resource.__resourceType)) {
		return resource;
	}

	const resourceType = readString(resource.resourceType);

	if (!resourceType) {
		return resource;
	}

	return attachInternalSourceResourceType(resource, resourceType);
}

function readString(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}
