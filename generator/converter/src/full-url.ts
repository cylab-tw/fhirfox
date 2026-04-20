import type { FhirResource } from './types.js';

const DEFAULT_FULL_URL_BASE = 'https://fhirfox.dev/fhir';

export function buildBundleFullUrl(fullUrlBase: string | undefined, resource: FhirResource): string | undefined {
	if (!resource.id) {
		return undefined;
	}

	// todo: switch to uuid

	const effectiveBase = fullUrlBase ?? DEFAULT_FULL_URL_BASE;
	const normalizedBase = effectiveBase.endsWith('/') ? effectiveBase.slice(0, -1) : effectiveBase;
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
