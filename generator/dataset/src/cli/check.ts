import { readResourceTypeDefinitionFiles, readYamlFile, readYamlFiles } from './files.js';
import { compileResourceDefinitions } from '#/model/index.js';
import { createValidationReport } from '#/validation/index.js';
import { resolve } from 'node:path';
import { validatePresets } from '#/preset/index.js';
import { validateScenario } from '#/scenario/index.js';

import type { ValidationIssue, ValidationReport } from '#/validation/index.js';
import type { Preset } from '#/preset/index.js';
import type { ScenarioDefinition } from '#/scenario/index.js';

/** Normalized inputs and report for dataset validation commands. */
export interface CheckData {
	options: CheckCliOptions;
	definitionFileCount: number;
	resourceDefinitionCount: number;
	sharedDefinitionCount: number;
	presetCount: number;
	scenarioCount: number;
	report: ValidationReport;
}

/** CLI entrypoint for dataset authoring validation. */
export function runCheck(args = process.argv.slice(3)): void {
	const options = parseArgs(args);
	const { report } = collectCheckData(options);

	if (report.errorCount > 0) {
		process.exitCode = 1;
	}

	console.log(formatValidationReport('FHIRfox dataset check', report));
}

/** Loads and validates the dataset package using the CLI check defaults. */
export function collectCheckData(options: CheckCliOptions): CheckData {
	const allDefinitionFiles = readYamlFiles<unknown>(options.definitions);
	const definitionFiles = readResourceTypeDefinitionFiles(options.definitions);
	const presets = readYamlFiles<Preset>(options.presets);
	const scenarios = options.scenario
		? [{ file: options.scenario, value: readYamlFile<ScenarioDefinition>(options.scenario) }]
		: readYamlFiles<ScenarioDefinition>(options.scenarios);

	const artifact = compileResourceDefinitions({
		definitions: definitionFiles.map((entry) => entry.value),
	});
	const issues = [
		...withPath(artifact.issues, options.definitions),
		...withPath(
			validatePresets(
				presets.map((entry) => entry.value),
				artifact.resourceTypeDefinitions,
			),
			options.presets,
		),
		...scenarios.flatMap((entry) =>
			withPath(
				validateScenario(
					entry.value,
					artifact.resourceTypeDefinitions,
					presets.map((preset) => preset.value),
				),
				entry.file,
			),
		),
	];
	return {
		options,
		definitionFileCount: allDefinitionFiles.length,
		resourceDefinitionCount: artifact.resourceTypeDefinitions.length,
		sharedDefinitionCount: allDefinitionFiles.length - definitionFiles.length,
		presetCount: presets.length,
		scenarioCount: scenarios.length,
		report: createValidationReport(issues),
	};
}

export interface CheckCliOptions {
	definitions: string;
	presets: string;
	scenarios: string;
	scenario?: string;
}

function parseArgs(args: string[]): CheckCliOptions {
	const values = new Map<string, string>();

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (!arg.startsWith('--')) {
			throw new Error(`Unexpected argument "${arg}".`);
		}

		const value = args[index + 1];
		if (!value || value.startsWith('--')) {
			throw new Error(`Missing value for "${arg}".`);
		}

		values.set(arg.slice(2), value);
		index += 1;
	}

	return {
		definitions: resolve(values.get('definitions') ?? '../../dataset/definitions'),
		presets: resolve(values.get('presets') ?? '../../dataset/presets'),
		scenarios: resolve(values.get('scenarios') ?? '../../scenarios'),
		scenario: values.has('scenario') ? resolve(values.get('scenario') ?? '') : undefined,
	};
}

function withPath(issues: ValidationIssue[], basePath: string): ValidationIssue[] {
	return issues.map((issue) => ({
		...issue,
		path: issue.path ? `${basePath}:${issue.path}` : basePath,
	}));
}

export function formatValidationReport(title: string, report: ValidationReport): string {
	const lines = [
		title,
		`errors: ${report.errorCount}`,
		`warnings: ${report.warningCount}`,
		`issues: ${report.issues.length}`,
	];

	for (const severity of ['error', 'warning'] as const) {
		const issues = report.issues.filter((issue) => issue.severity === severity);
		if (issues.length === 0) {
			continue;
		}

		lines.push('', `${severity === 'error' ? 'Errors' : 'Warnings'}:`);
		for (const issue of issues) {
			lines.push(`- ${issue.code}: ${issue.message}${issue.path ? ` (${issue.path})` : ''}`);
		}
	}

	return lines.join('\n');
}
