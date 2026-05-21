import { assertCardinality, isMany } from './cardinality.js';
import { selectReferences } from './select.js';

import type { FieldDefinition, SourceResource } from '#/model/index.js';
import type { ReferenceSpec, ResolvedReference } from './types.js';
import type { DatasetProvider } from '#/provider/index.js';

/** Lookups needed to fill a reference field without coupling to the resolver. */
export type ReferenceLookup = {
	getField(fieldId: string): FieldDefinition | undefined;
	getResource(alias: string): { key: string; id: string; resourceType: string } | undefined;
	query: DatasetProvider['queryResources'];
	seed: string;
};

/** Resolves an alias reference or provider selection into ids to emit. */
export async function resolveReference(
	field: string,
	spec: ReferenceSpec,
	lookup: ReferenceLookup,
): Promise<ResolvedReference> {
	if (typeof spec === 'string') {
		const target = lookup.getResource(spec);
		if (!target) {
			throw new Error(`Unknown reference alias "${spec}".`);
		}
		return {
			field,
			targetKeys: [target.key],
			targetIds: [target.id],
			cardinality: '1..1',
			targetResourceType: target.resourceType,
		};
	}

	if ('alias' in spec) {
		const target = lookup.getResource(spec.alias);
		if (!target) {
			throw new Error(`Unknown reference alias "${spec.alias}".`);
		}
		return {
			field,
			targetKeys: [target.key],
			targetIds: [target.id],
			cardinality: spec.cardinality ?? '1..1',
			targetResourceType: target.resourceType,
		};
	}

	const matches = await lookup.query(spec.resourceType, spec.select);
	const selected = selectReferences(matches, spec, lookup.seed);
	const cardinality = spec.cardinality ?? '1..1';
	assertCardinality(selected.length, cardinality);

	return {
		field,
		targetKeys: selected.map((resource) => `${spec.resourceType}/${resource.id}`),
		targetIds: selected.map((resource: SourceResource) => resource.id),
		cardinality,
		targetResourceType: spec.resourceType,
		selectedResources: selected.map((resource) => ({
			key: `${spec.resourceType}/${resource.id}`,
			resourceType: spec.resourceType,
			resource,
		})),
	};
}

/** Converts resolved target ids into the value written to the source field. */
export function referenceValue(reference: ResolvedReference): string | string[] | undefined {
	if (reference.targetIds.length === 0) {
		return undefined;
	}

	return isMany(reference.cardinality) ? reference.targetIds : reference.targetIds[0];
}
