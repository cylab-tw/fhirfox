import { generateResourceByRules } from '../generator/generate-resource.js';

import { GeneratorRepository } from '../repositories/generator-repository.js';

import { compileScenarioDefinition } from './compile-scenario.js';

import { loadScenarioDefinition } from './load-scenario.js';

import type { ScenarioExecutionResult } from './types.js';

export async function executeScenario(params: {
	igName: string;
	igVersion: string;
	scenarioId: string;
	scenarioRootDirectory: string;
	repository: GeneratorRepository;
}): Promise<ScenarioExecutionResult> {
	const scenarioDefinition = await loadScenarioDefinition(params.scenarioId, params.scenarioRootDirectory);
	const scenario = compileScenarioDefinition(scenarioDefinition);
	const selectedResourceIds = await params.repository.findScenarioResourceIds({
		igName: params.igName,
		igVersion: params.igVersion,
		plan: scenario,
	});

	const resources = (
		await Promise.all(
			scenario.includeResourceTypes.flatMap((resourceType) =>
				(selectedResourceIds[resourceType] ?? []).map((id) =>
					generateResourceByRules(
						{
							igName: params.igName,
							igVersion: params.igVersion,
							resourceType,
							id,
						},
						params.repository,
					),
				),
			),
		)
	).filter((resource): resource is NonNullable<typeof resource> => resource !== null);

	return {
		scenario,
		selectedResourceIds,
		resources,
	};
}
