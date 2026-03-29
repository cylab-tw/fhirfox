import { buildBundleFullUrl, buildBundleReferenceIndex, rewriteBundleReferences } from '../full-url.js';

import type { ConvertOptions, FhirBundle, FhirResource } from '../types.js';

/**
 * Wraps converted resources in a simple collection bundle.
 */
export function assembleBundle(resources: FhirResource[], options: Pick<ConvertOptions, 'fullUrlBase'>): FhirBundle {
	const fullUrlByReference = buildBundleReferenceIndex(resources, options.fullUrlBase);
	const entries = resources.map((resource) => ({
		resource,
		fullUrl: buildBundleFullUrl(options.fullUrlBase, resource),
	}));

	return {
		resourceType: 'Bundle',
		type: 'collection',
		entry: entries.map(({ resource, fullUrl }) => ({
			...(fullUrl ? { fullUrl } : {}),
			resource: rewriteBundleReferences(resource, fullUrlByReference),
		})),
	};
}
