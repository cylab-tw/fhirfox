import type { ResolvedReference } from './types.js';
import type { ResourceGraphEdge } from '#/resolution/types.js';

/** Converts a resolved reference into graph edges from one source record. */
export function toReferenceEdge(from: string, reference: ResolvedReference): ResourceGraphEdge[] {
	return reference.targetKeys.map((to) => ({
		from,
		to,
		field: reference.field,
		relation: 'reference',
		cardinality: reference.cardinality,
		reference: {
			targetResourceType: reference.targetResourceType,
			typeField: reference.typeField,
			typeValue: reference.typeValue,
		},
	}));
}
