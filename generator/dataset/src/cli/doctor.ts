import { collectCheckData } from './check.js';
import { resolve } from 'node:path';

import type { CheckCliOptions } from './check.js';

/** CLI entrypoint for a human-readable dataset health check. */
export function runDoctor(args = process.argv.slice(3)): void {
	try {
		const options = parseArgs(args);
		const data = collectCheckData(options);
		const ok = data.report.errorCount === 0;

		console.log('FHIRfox dataset doctor');
		console.log(`definition files: ${data.definitionFileCount}`);
		console.log(`resource definitions: ${data.resourceDefinitionCount}`);
		console.log(`shared catalog files skipped: ${data.sharedDefinitionCount}`);
		console.log(`presets: ${data.presetCount}`);
		console.log(`scenarios: ${data.scenarioCount}`);
		console.log(`warnings: ${data.report.warningCount}`);
		console.log(`errors: ${data.report.errorCount}`);

		if (!ok) {
			process.exitCode = 1;
			for (const issue of data.report.issues.filter((issue) => issue.severity === 'error').slice(0, 10)) {
				console.error(`${issue.code}: ${issue.message}${issue.path ? ` (${issue.path})` : ''}`);
			}
		}
	} catch (error) {
		process.exitCode = 1;
		console.error(error instanceof Error ? error.message : String(error));
	}
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
		definitions: values.get('definitions') ?? resolve('../../dataset/definitions'),
		presets: values.get('presets') ?? resolve('../../dataset/presets'),
		scenarios: values.get('scenarios') ?? resolve('../../dataset/scenarios'),
		scenario: values.has('scenario') ? resolve(values.get('scenario') ?? '') : undefined,
	};
}
