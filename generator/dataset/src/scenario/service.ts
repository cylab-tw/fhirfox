import { resolveScenario as resolveScenarioImpl } from './resolve.js';

import type { ResolvedScenario, Scenario } from './scenario.js';
import type { DatasetProvider } from '../providers/index.js';

/**
 * Owns scenario definitions and resolves them against source resources.
 *
 * This keeps clinical-event selection logic separate from the storage-facing
 * provider interface.
 */
export interface ScenarioService {
	listScenarios(): Promise<Scenario[]>;
	resolveScenario(scenarioId: Scenario['id']): Promise<ResolvedScenario>;
}

/**
 * Creates a scenario service backed by a dataset provider and an in-memory
 * collection of scenario definitions.
 */
export function createScenarioService(options: { provider: DatasetProvider; scenarios: Scenario[] }): ScenarioService {
	const { provider, scenarios } = options;

	return {
		async listScenarios() {
			return [...scenarios];
		},

		async resolveScenario(scenarioId) {
			const scenario = scenarios.find((entry) => entry.id === scenarioId);

			if (!scenario) {
				throw new Error(`Unknown scenario: ${scenarioId}`);
			}

			return resolveScenarioImpl(provider, scenario);
		},
	};
}
