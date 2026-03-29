import { readFileSync } from 'node:fs';

export interface ScenarioLevelDefinition {
	level: number;
	label: string;
	title: string;
	englishTitle: string;
	description: string;
}

export const SCENARIO_LEVEL_DEFINITIONS = JSON.parse(
	readFileSync(new URL('../../../../dataset/scenarios/levels.json', import.meta.url), 'utf8'),
) as ScenarioLevelDefinition[];

export function getScenarioLevelDefinition(level?: number): ScenarioLevelDefinition | null {
	if (typeof level !== 'number') {
		return null;
	}

	return SCENARIO_LEVEL_DEFINITIONS.find((entry) => entry.level === level) ?? null;
}
