import type { ResourceGraphEdge, ResourceGraphNode, ResourceRelationGraph } from './types.js';

/** Creates the resolved resource relation graph. */
export function createGraph(nodes: ResourceGraphNode[], edges: ResourceGraphEdge[]): ResourceRelationGraph {
	return { nodes, edges };
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
