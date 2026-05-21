import type { ResourceFieldProvenance } from './types.js';

/** Creates a compact explanation of where one field value came from. */
export function provenance(
	field: string,
	source: ResourceFieldProvenance['source'],
	from?: string,
): ResourceFieldProvenance {
	return { field, source, from };
}
