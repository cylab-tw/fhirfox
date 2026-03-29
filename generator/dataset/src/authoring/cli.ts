import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { parse } from 'yaml';

import { buildSourceAuthoringSchema, validateDatasetAuthoring } from './index.js';

type CsvRow = Record<string, string>;
const SCENARIO_SCHEMA_FILENAME = 'schema.yaml';

async function main(): Promise<void> {
	const mode = process.argv[2] === 'doctor' ? 'doctor' : 'check';
	const packageRoot = process.cwd();
	const repoRoot = path.resolve(packageRoot, '..', '..');
	const datasetRoot = path.join(repoRoot, 'dataset');
	const scenariosRoot = path.join(repoRoot, 'scenarios');

	const [schema, resources, scenarios, codeMappings, generatorRuleMappings] = await Promise.all([
		loadSourceAuthoringSchema(path.join(datasetRoot, 'resources', 'definitions')),
		loadResources(path.join(datasetRoot, 'resources')),
		loadScenarios(scenariosRoot),
		loadCodeMappings(path.join(datasetRoot, 'converter', 'code-mappings')),
		loadGeneratorRuleMappings(path.join(datasetRoot, 'converter', 'generator-rules')),
	]);

	const report = validateDatasetAuthoring({
		schema,
		resources,
		scenarios,
		codeMappings,
		generatorRuleMappings,
	});

	if (mode === 'doctor') {
		console.log(`Dataset doctor summary: ${report.errorCount} error(s), ${report.warningCount} warning(s).`);
	} else if (report.warningCount > 0) {
		console.log(`Dataset check found ${report.warningCount} warning(s).`);
	}

	for (const issue of report.issues) {
		const prefix = issue.severity === 'error' ? 'ERROR' : 'WARN';
		console.log(`${prefix} [${issue.code}] ${issue.path}`);
		console.log(`  ${issue.message}`);

		if (issue.help) {
			console.log(`  Fix: ${issue.help}`);
		}
	}

	if (report.errorCount > 0) {
		process.exitCode = 1;
	}
}

async function loadSourceAuthoringSchema(directoryPath: string) {
	const entries = await readdir(directoryPath, { withFileTypes: true });
	const documents = await Promise.all(
		entries
			.filter((entry) => entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')))
			.map(async (entry) => {
				const content = await readFile(path.join(directoryPath, entry.name), 'utf8');
				return parse(content) as Record<string, unknown>;
			}),
	);

	return buildSourceAuthoringSchema(documents);
}

async function loadResources(resourcesDir: string) {
	const resourceTypes = (await readdir(resourcesDir, { withFileTypes: true }))
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();

	const loaded = await Promise.all(
		resourceTypes.map(async (resourceType) => {
			const resourceDir = path.join(resourcesDir, resourceType);
			const files = (await readdir(resourceDir, { withFileTypes: true }))
				.filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
				.map((entry) => entry.name)
				.sort();

			return Promise.all(
				files.map(async (filename) => ({
					path: path.relative(process.cwd(), path.join(resourceDir, filename)),
					resourceType,
					value: JSON.parse(await readFile(path.join(resourceDir, filename), 'utf8')) as Record<string, unknown>,
				})),
			);
		}),
	);

	return loaded.flat();
}

async function loadScenarios(scenariosDir: string) {
	const files = (await readdir(scenariosDir, { withFileTypes: true }))
		.filter(
			(entry) =>
				entry.isFile() &&
				(entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) &&
				entry.name !== SCENARIO_SCHEMA_FILENAME,
		)
		.map((entry) => entry.name)
		.sort();

	return Promise.all(
		files.map(async (filename) => ({
			path: path.relative(process.cwd(), path.join(scenariosDir, filename)),
			document: parse(await readFile(path.join(scenariosDir, filename), 'utf8')) as Record<string, unknown>,
		})),
	);
}

async function loadCodeMappings(directoryPath: string) {
	const entries = await readdir(directoryPath, { withFileTypes: true });
	const files = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith('.csv'))
		.map((entry) => path.join(directoryPath, entry.name))
		.sort();

	const rows = await Promise.all(
		files.map((filePath) => loadCsv(filePath).then((loaded) => loaded.map((row) => ({ filePath, row })))),
	);

	return rows.flat().map(({ filePath, row }) => ({
		path: path.relative(process.cwd(), filePath),
		mappingKey: path.basename(filePath, '.csv'),
		sourceCode: row.source_code ?? '',
		targetCode: row.target_code ?? '',
		targetSystem: row.target_system ?? '',
		targetDisplay: row.target_display,
	}));
}

async function loadGeneratorRuleMappings(directoryPath: string) {
	const entries = await readdir(directoryPath, { withFileTypes: true });
	const files = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith('.csv'))
		.map((entry) => path.join(directoryPath, entry.name))
		.sort();

	const rows = await Promise.all(
		files.map((filePath) => loadCsv(filePath).then((loaded) => loaded.map((row) => ({ filePath, row })))),
	);

	return rows.flat().map(({ filePath, row }) => ({
		path: path.relative(process.cwd(), filePath),
		resourceType: row.resource_type ?? '',
		sourceColumn: row.source_column ?? '',
		mappingKey: row.mapping_key || undefined,
	}));
}

async function loadCsv(filePath: string): Promise<CsvRow[]> {
	const content = await readFile(filePath, 'utf8');
	return parseCsv(content);
}

function parseCsv(input: string): CsvRow[] {
	const lines = input
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	if (lines.length === 0) {
		return [];
	}

	const headers = parseCsvLine(lines[0] ?? '');

	return lines.slice(1).map((line) => {
		const values = parseCsvLine(line);
		const row: CsvRow = {};

		for (const [index, header] of headers.entries()) {
			row[header] = values[index] ?? '';
		}

		return row;
	});
}

function parseCsvLine(line: string): string[] {
	const values: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let index = 0; index < line.length; index += 1) {
		const character = line[index];
		const next = line[index + 1];

		if (character === '"' && inQuotes && next === '"') {
			current += '"';
			index += 1;
			continue;
		}

		if (character === '"') {
			inQuotes = !inQuotes;
			continue;
		}

		if (character === ',' && !inQuotes) {
			values.push(current);
			current = '';
			continue;
		}

		current += character;
	}

	values.push(current);
	return values;
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
