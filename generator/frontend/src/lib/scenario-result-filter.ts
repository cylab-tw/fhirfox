import { attachInternalSourceResourceType, readSourceResourceType } from '@fhirfox/converter/browser';

import type { ScenarioResultRecord, SourceResourceRecord } from '../types.js';
import type { ResourceGraphTree } from '@fhirfox-generator/dataset';

export function filterScenarioResult(
	result: ScenarioResultRecord | null,
	excludedResourceTypes?: readonly string[],
	excludedReferenceFields: Readonly<Record<string, readonly string[]>> = {},
): ScenarioResultRecord | null {
	if (!result || !excludedResourceTypes?.length) {
		return result;
	}

	const excludedTypes = new Set(excludedResourceTypes.map((resourceType) => resourceType.toLowerCase()));
	const orderedResources = result.orderedResources
		.filter((resource) => !excludedTypes.has(readSourceResourceType(resource).toLowerCase()))
		.map((resource) => removeExcludedReferences(resource, excludedReferenceFields));
	const resources = Object.fromEntries(
		Object.entries(result.resources)
			.filter(([resourceType]) => !excludedTypes.has(resourceType.toLowerCase()))
			.map(([resourceType, entries]) => [
				resourceType,
				entries.map((resource) => removeExcludedReferences(resource, excludedReferenceFields)),
			]),
	);

	return {
		...result,
		resources,
		orderedResources,
		graph: {
			...result.graph,
			tree: result.graph.tree.flatMap((node) => filterGraphNode(node, excludedTypes)),
		},
		meta: {
			...result.meta,
			totalResources: orderedResources.length,
		},
	};
}

function removeExcludedReferences(
	resource: SourceResourceRecord,
	excludedReferenceFields: Readonly<Record<string, readonly string[]>>,
): SourceResourceRecord {
	const resourceType = readSourceResourceType(resource);
	const excludedFields = new Set([
		...(excludedReferenceFields['*'] ?? []),
		...(excludedReferenceFields[resourceType.toLowerCase()] ?? []),
	]);
	const filteredResource = Object.fromEntries(
		Object.entries(resource).filter(([field]) => !excludedFields.has(field)),
	) as SourceResourceRecord;

	return attachInternalSourceResourceType(filteredResource, resourceType);
}

function filterGraphNode(node: ResourceGraphTree, excludedTypes: ReadonlySet<string>): ResourceGraphTree[] {
	const children = node.children.flatMap((child) => filterGraphNode(child, excludedTypes));

	if (excludedTypes.has(node.resourceType.toLowerCase())) {
		return children;
	}

	return [{ ...node, children }];
}
