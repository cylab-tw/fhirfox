import { readFile, readdir } from 'node:fs/promises';

import { join, resolve } from 'node:path';

import { parse } from 'yaml';

import type { ScenarioDefinition } from './types.js';

async function listScenarioFiles(directoryPath: string): Promise<string[]> {
	const entries = await readdir(directoryPath, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const fullPath = join(directoryPath, entry.name);

			if (entry.isDirectory()) {
				return listScenarioFiles(fullPath);
			}

			return entry.isFile() && entry.name.endsWith('.yaml') ? [fullPath] : [];
		}),
	);

	return files.flat();
}

function assertScenarioDefinition(value: unknown, scenarioPath: string): ScenarioDefinition {
	if (!value || typeof value !== 'object') {
		throw new Error(`Scenario file ${scenarioPath} did not contain a YAML object`);
	}

	const scenario = value as Partial<ScenarioDefinition>;
	if (!scenario.id) {
		throw new Error(`Scenario file ${scenarioPath} must define id`);
	}

	return scenario as ScenarioDefinition;
}

export async function loadScenarioDefinition(
	scenarioId: string,
	scenarioRootDirectory: string,
): Promise<ScenarioDefinition> {
	const rootDirectory = resolve(scenarioRootDirectory);
	const scenarioFiles = await listScenarioFiles(rootDirectory);
	const matchingPath = scenarioFiles.find(
		(filePath) => filePath.endsWith(`${scenarioId}.yaml`) || filePath.endsWith(`${scenarioId}.yml`),
	);

	if (!matchingPath) {
		throw new Error(`Scenario ${scenarioId} was not found under ${rootDirectory}`);
	}

	const contents = await readFile(matchingPath, 'utf8');
	const parsed = parse(contents);

	return assertScenarioDefinition(parsed, matchingPath);
}
