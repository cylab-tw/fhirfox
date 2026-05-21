import type { ScenarioDefinition, ScenarioResourceDefinition } from './types.js';

/** Expands count and normalizes optional scenario resource containers. */
export function normalizeScenario(scenario: ScenarioDefinition): ScenarioDefinition {
	return {
		...scenario,
		resources: scenario.resources.flatMap(expandCount).map((resource) => ({
			...resource,
			with: resource.with ?? [],
			references: resource.references ?? {},
			inputs: resource.inputs ?? {},
		})),
	};
}

function expandCount(resource: ScenarioResourceDefinition): ScenarioResourceDefinition[] {
	const count = resource.count ?? 1;

	if (count <= 1) {
		return [resource];
	}

	return Array.from({ length: count }, (_entry, index) => ({
		...resource,
		alias: `${resource.alias}.${index + 1}`,
		count: undefined,
	}));
}
