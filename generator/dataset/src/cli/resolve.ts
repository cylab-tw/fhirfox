import { readResourceTypeDefinitionFiles, readYamlDirectory, readYamlFile } from './files.js';
import { createInMemoryDatasetProvider } from '#/provider/index.js';
import { resolve } from 'node:path';
import { resolveScenario } from '#/resolution/index.js';

import type { Preset } from '#/preset/index.js';
import type { ScenarioDefinition } from '#/scenario/index.js';

interface ResolveCliOptions {
	definitions: string;
	presets: string;
	scenario: string;
	seed: string;
	now?: Date;
	generatedAt?: string;
	explain: boolean;
}

/** CLI entrypoint for resolving one authored scenario YAML file. */
export async function runResolve(args = process.argv.slice(3)): Promise<void> {
	const options = parseArgs(args);
	const definitions = readResourceTypeDefinitionFiles(options.definitions).map((entry) => entry.value);
	const presets = readYamlDirectory<Preset>(options.presets);
	const scenario = readYamlFile<ScenarioDefinition>(options.scenario);
	const provider = createInMemoryDatasetProvider({
		resourceTypeDefinitions: definitions,
		presets,
	});

	const resolved = await resolveScenario(provider, scenario, {
		seed: options.seed,
		now: options.now,
		generatedAt: options.generatedAt,
		includeExplanation: options.explain,
	});

	console.log(formatResolvedScenario(resolved));
}

function parseArgs(args: string[]): ResolveCliOptions {
	const values = new Map<string, string>();
	const flags = new Set<string>();

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (!arg.startsWith('--')) {
			throw new Error(`Unexpected argument "${arg}".`);
		}
		if (arg === '--explain') {
			flags.add('explain');
			continue;
		}

		const value = args[index + 1];
		if (!value || value.startsWith('--')) {
			throw new Error(`Missing value for "${arg}".`);
		}

		values.set(arg.slice(2), value);
		index += 1;
	}

	const scenario = values.get('scenario');
	if (!scenario) {
		throw new Error('Missing required --scenario path.');
	}

	const now = values.get('now');
	return {
		definitions: values.get('definitions') ?? resolve('../../dataset/definitions'),
		presets: values.get('presets') ?? resolve('../../dataset/presets'),
		scenario: resolve(scenario),
		seed: values.get('seed') ?? 'demo',
		now: now ? new Date(now) : undefined,
		generatedAt: values.get('generated-at'),
		explain: flags.has('explain'),
	};
}

type ResolvedScenarioSummary = Awaited<ReturnType<typeof resolveScenario>>;

function formatResolvedScenario(resolved: ResolvedScenarioSummary): string {
	const lines = [
		`Scenario: ${resolved.metadata.scenarioName} (${resolved.metadata.scenarioId})`,
		`Generated at: ${resolved.metadata.generatedAt}`,
		`Seed: ${resolved.metadata.seed}`,
		`Resources: ${resolved.metadata.stats.resourceCount} (${resolved.metadata.stats.explicitResourceCount} explicit, ${resolved.metadata.stats.implicitResourceCount} implicit)`,
		`Relations: ${resolved.metadata.stats.relationCount}`,
		`Warnings: ${resolved.metadata.stats.warningCount}`,
	];

	if (resolved.warnings.length > 0) {
		lines.push('', 'Warnings:');
		for (const warning of resolved.warnings) {
			const context = [warning.alias, warning.field].filter(Boolean).join('.');
			lines.push(`- ${warning.code}: ${warning.message}${context ? ` (${context})` : ''}`);
		}
	}

	lines.push('', 'Resources:');
	for (const resource of resolved.resources) {
		lines.push(`- ${resource.key} (${resource.origin}, ${resource.materialization})`);
	}

	if (resolved.explanation) {
		lines.push('', 'Explanation:');
		for (const event of resolved.explanation.events) {
			lines.push(`- ${event.code}: ${event.message}`);
		}
	}

	return lines.join('\n');
}
