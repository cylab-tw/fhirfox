import type { FhirResource } from './types.js';

export function buildBundleFullUrl(fullUrlBase: string | undefined, resource: FhirResource): string | undefined {
	if (!resource.id) {
		return undefined;
	}

	if (!fullUrlBase) {
		return `urn:uuid:${buildDeterministicUuid(resource.resourceType, resource.id)}`;
	}

	const normalizedBase = fullUrlBase.endsWith('/') ? fullUrlBase.slice(0, -1) : fullUrlBase;
	return `${normalizedBase}/${resource.resourceType}/${resource.id}`;
}

export function buildBundleReferenceIndex(
	resources: FhirResource[],
	fullUrlBase: string | undefined,
): Map<string, string> {
	const index = new Map<string, string>();

	for (const resource of resources) {
		const fullUrl = buildBundleFullUrl(fullUrlBase, resource);

		if (fullUrl && resource.id) {
			index.set(`${resource.resourceType}/${resource.id}`, fullUrl);
		}
	}

	return index;
}

export function rewriteBundleReferences<TValue>(value: TValue, fullUrlByReference: Map<string, string>): TValue {
	if (Array.isArray(value)) {
		return value.map((entry) => rewriteBundleReferences(entry, fullUrlByReference)) as TValue;
	}

	if (typeof value !== 'object' || value === null) {
		return value;
	}

	const record = value as Record<string, unknown>;
	const rewritten: Record<string, unknown> = {};

	for (const [key, entryValue] of Object.entries(record)) {
		if (key === 'reference' && typeof entryValue === 'string') {
			rewritten[key] = fullUrlByReference.get(entryValue) ?? entryValue;
			continue;
		}

		rewritten[key] = rewriteBundleReferences(entryValue, fullUrlByReference);
	}

	return rewritten as TValue;
}

function buildDeterministicUuid(resourceType: string, resourceId: string): string {
	const seed = `${resourceType}/${resourceId}`;
	const bytes = new Uint8Array(16);

	for (let index = 0; index < seed.length; index += 1) {
		const charCode = seed.charCodeAt(index);
		bytes[index % 16] = (bytes[index % 16] + charCode + index) % 256;
		bytes[(index * 7) % 16] = (bytes[(index * 7) % 16] ^ charCode) % 256;
	}

	bytes[6] = (bytes[6] & 0x0f) | 0x50;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;

	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
