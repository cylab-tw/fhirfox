import type { ResourceGraphEdge, ResourceGraphNode, ResourceRelationGraph, ResourceGraphTree } from './types.js';

/** Creates the resolved resource relation graph. */
export function createGraph(nodes: ResourceGraphNode[], edges: ResourceGraphEdge[]): ResourceRelationGraph {
	return { tree: buildInstanceTree(nodes, edges) };
}

/** Orders graph node keys by walking the relation graph depth-first. */
export function orderGraphKeys(nodes: ResourceGraphNode[], edges: ResourceGraphEdge[]): string[] {
	const nodeKeys = new Set(nodes.map((node) => node.key));
	const originalIndex = new Map(nodes.map((node, index) => [node.key, index] as const));
	const children = new Map<string, Set<string>>(nodes.map((node) => [node.key, new Set<string>()]));

	for (const edge of edges) {
		if (!nodeKeys.has(edge.from) || !nodeKeys.has(edge.to) || edge.from === edge.to) {
			continue;
		}

		if (!children.get(edge.from)?.has(edge.to)) {
			children.get(edge.from)?.add(edge.to);
		}
	}

	const ordered: string[] = [];
	const visited = new Set<string>();

	function visit(key: string): void {
		if (visited.has(key)) {
			return;
		}

		visited.add(key);
		ordered.push(key);

		const orderedChildren = [...(children.get(key) ?? [])].sort(
			(left, right) => (originalIndex.get(left) ?? 0) - (originalIndex.get(right) ?? 0),
		);
		for (const child of orderedChildren) {
			visit(child);
		}
	}

	for (const node of nodes) {
		visit(node.key);
	}

	return ordered;
}


function buildInstanceTree(nodes: ResourceGraphNode[], edges: ResourceGraphEdge[]): ResourceGraphTree[] {
	const nodeByKey = new Map(nodes.map((node) => [node.key, node]));
	const parentByKey = new Map<string, string | null>();

	for (const node of nodes) {
		parentByKey.set(node.key, null);
	}

	const candidates = new Map<string, { parentKey: string; priority: number }>();

	for (const edge of edges) {
		const fromNode = nodeByKey.get(edge.from);
		const toNode = nodeByKey.get(edge.to);

		if (!fromNode || !toNode) {
			continue;
		}

		for (const rule of DISPLAY_PARENT_RULES) {
			const forward = sameType(fromNode.resourceType, rule.fromType) && sameType(toNode.resourceType, rule.toType);
			const backward = sameType(fromNode.resourceType, rule.toType) && sameType(toNode.resourceType, rule.fromType);

			if ((!forward && !backward) || !fieldMatches(edge.field, rule.field)) {
				continue;
			}

			const parentKey = sameType(fromNode.resourceType, rule.parentType) ? edge.from : edge.to;
			const childKey = parentKey === edge.from ? edge.to : edge.from;

			const existing = candidates.get(childKey);
			if (!existing || rule.priority > existing.priority) {
				candidates.set(childKey, {
					parentKey,
					priority: rule.priority,
				});
			}
		}

		// Fallback for anything referencing Encounter via 'encounter' field
		if (sameType(toNode.resourceType, 'Encounter') && fieldMatches(edge.field, 'encounter')) {
			const existing = candidates.get(edge.from);
			if (!existing || 10 > existing.priority) {
				candidates.set(edge.from, {
					parentKey: edge.to,
					priority: 10,
				});
			}
		}
	}

	for (const [childKey, candidate] of candidates.entries()) {
		parentByKey.set(childKey, candidate.parentKey);
	}

	const childrenByParent = new Map<string, string[]>();
	for (const [childKey, parentKey] of parentByKey.entries()) {
		if (!parentKey) {
			continue;
		}

		const children = childrenByParent.get(parentKey) ?? [];
		children.push(childKey);
		childrenByParent.set(parentKey, children);
	}

	function buildNode(key: string): ResourceGraphTree | null {
		const node = nodeByKey.get(key);
		if (!node) {
			return null;
		}

		return {
			resourceType: node.resourceType,
			id: key.split('/').pop() ?? '',
			children: (childrenByParent.get(key) ?? [])
				.map((childKey) => buildNode(childKey))
				.filter((child): child is ResourceGraphTree => child !== null),
		};
	}

	return nodes
		.filter((node) => parentByKey.get(node.key) === null)
		.map((node) => buildNode(node.key))
		.filter((node): node is ResourceGraphTree => node !== null);
}

function sameType(left: string, right: string): boolean {
	return normalizeComparableType(left) === normalizeComparableType(right);
}

function normalizeComparableType(resourceType: string): string {
	const normalized = resourceType.toLowerCase();

	if (normalized === 'observation-laboratory-result' || normalized === 'observation-vital-signs') {
		return 'observation';
	}

	return normalized;
}

function fieldMatches(actual: string | undefined, expected: string | undefined): boolean {
	if (!expected) {
		return true;
	}

	if (!actual) {
		return false;
	}

	return actual.toLowerCase().includes(expected.toLowerCase());
}

type DisplayParentRule = {
	parentType: string;
	childType: string;
	fromType: string;
	toType: string;
	field?: string;
	priority: number;
};

const DISPLAY_PARENT_RULES: DisplayParentRule[] = [
	{
		parentType: 'Patient',
		childType: 'Encounter',
		fromType: 'Encounter',
		toType: 'Patient',
		priority: 100,
	},
	{
		parentType: 'Patient',
		childType: 'Organization',
		fromType: 'Patient',
		toType: 'Organization',
		priority: 100,
	},
	{
		parentType: 'Patient',
		childType: 'Practitioner',
		fromType: 'Patient',
		toType: 'Practitioner',
		priority: 10,
	},
	{
		parentType: 'Encounter',
		childType: 'Observation',
		fromType: 'Observation',
		toType: 'Encounter',
		priority: 100,
	},
	{
		parentType: 'Encounter',
		childType: 'MedicationRequest',
		fromType: 'MedicationRequest',
		toType: 'Encounter',
		priority: 100,
	},
	{
		parentType: 'Encounter',
		childType: 'Condition',
		fromType: 'Condition',
		toType: 'Encounter',
		priority: 100,
	},
	{
		parentType: 'Encounter',
		childType: 'Procedure',
		fromType: 'Procedure',
		toType: 'Encounter',
		priority: 100,
	},
	{
		parentType: 'Encounter',
		childType: 'DiagnosticReport',
		fromType: 'DiagnosticReport',
		toType: 'Encounter',
		priority: 100,
	},
	{
		parentType: 'Encounter',
		childType: 'ImagingStudy',
		fromType: 'ImagingStudy',
		toType: 'Encounter',
		priority: 100,
	},
	{
		parentType: 'Encounter',
		childType: 'AllergyIntolerance',
		fromType: 'AllergyIntolerance',
		toType: 'Encounter',
		priority: 100,
	},
	{
		parentType: 'Encounter',
		childType: 'PractitionerRole',
		fromType: 'Encounter',
		toType: 'PractitionerRole',
		priority: 90,
	},
	{
		parentType: 'Encounter',
		childType: 'Practitioner',
		fromType: 'Encounter',
		toType: 'Practitioner',
		priority: 70,
	},
	{
		parentType: 'Encounter',
		childType: 'Organization',
		fromType: 'Encounter',
		toType: 'Organization',
		priority: 50,
	},
	{
		parentType: 'PractitionerRole',
		childType: 'Practitioner',
		fromType: 'PractitionerRole',
		toType: 'Practitioner',
		priority: 100,
	},
	{
		parentType: 'MedicationRequest',
		childType: 'Medication',
		fromType: 'MedicationRequest',
		toType: 'Medication',
		priority: 100,
	},
];
