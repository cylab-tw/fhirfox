import { readFile, readdir } from 'node:fs/promises';
import { attachInternalSourceResourceType } from '@fhirfox/converter/browser';
import { buildSourceAuthoringSchema } from '../../dataset/src/authoring/source-fields.ts';
import { normalizeScenario } from '../../dataset/src/index.ts';
import { parse } from 'yaml';
import path from 'node:path';

import type { ScenarioDocument, ScenarioLevelDefinition, SourceAuthoringSchema } from '../../dataset/src/index.ts';
import type { ScenarioLevel, ScenarioRecord, SourceFieldDocRecord } from './types.js';
import type { SourceResource, StaticConverterRows } from '@fhirfox/converter/browser';

const SCENARIO_SCHEMA_FILENAME = 'schema.yaml';

export async function loadSourceFieldDocs(directoryPath: string): Promise<{
	docs: Record<string, SourceFieldDocRecord>;
	order: Record<string, string[]>;
	schema: SourceAuthoringSchema;
}> {
	const entries = await readdir(directoryPath, { withFileTypes: true });
	const docFiles = entries
		.filter((entry) => entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')))
		.map((entry) => path.join(directoryPath, entry.name))
		.sort();

	const docsByFile = await Promise.all(
		docFiles.map(async (filePath) => {
			const content = await readFile(filePath, 'utf8');
			return parse(content) as Record<string, unknown>;
		}),
	);
	const schema = buildSourceAuthoringSchema(docsByFile);

	return {
		docs: schema.docs,
		order: schema.order,
		schema,
	};
}

export async function loadResources(resourcesDir: string): Promise<SourceResource[]> {
	const resourceTypes = (await readdir(resourcesDir, { withFileTypes: true }))
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();

	const resources = await Promise.all(
		resourceTypes.map(async (resourceType) => {
			const resourceDir = path.join(resourcesDir, resourceType);
			const files = (await readdir(resourceDir, { withFileTypes: true }))
				.filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
				.map((entry) => entry.name)
				.sort();

			return Promise.all(
				files.map(async (filename) => {
					const content = await readFile(path.join(resourceDir, filename), 'utf8');
					const parsed = JSON.parse(content) as SourceResource;

					return attachInternalSourceResourceType(parsed, resourceType);
				}),
			);
		}),
	);

	return resources.flat();
}

export async function loadScenarios(scenariosDir: string): Promise<ScenarioRecord[]> {
	try {
		const entries = await readdir(scenariosDir, { withFileTypes: true });
		const scenarioFiles = entries
			.filter(
				(entry) =>
					entry.isFile() &&
					(entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) &&
					entry.name !== SCENARIO_SCHEMA_FILENAME,
			)
			.map((entry) => entry.name)
			.sort();

		return Promise.all(
			scenarioFiles.map(async (filename) => {
				const content = await readFile(path.join(scenariosDir, filename), 'utf8');
				return normalizeScenarioDocument(parse(content) as Record<string, unknown>);
			}),
		);
	} catch {
		return [];
	}
}

export async function loadScenarioLevelDefinitions(filePath: string): Promise<ScenarioLevelDefinition[]> {
	const content = await readFile(filePath, 'utf8');

	if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
		return parse(content) as ScenarioLevelDefinition[];
	}

	return JSON.parse(content) as ScenarioLevelDefinition[];
}

export async function loadConverterRows(converterDir: string, igName: string): Promise<StaticConverterRows> {
	const [generatorRules, resourceProfiles, codeMappings] = await Promise.all([
		loadCsv(path.join(converterDir, 'generator-rules', `${igName}.csv`)),
		loadCsv(path.join(converterDir, 'resource-profiles.csv')),
		loadCsvDirectory(path.join(converterDir, 'code-mappings')),
	]);

	return {
		generatorRules: generatorRules.map((row) => ({
			igName: requiredCell(row, 'ig_name'),
			igVersion: requiredCell(row, 'ig_version'),
			resourceType: requiredCell(row, 'resource_type'),
			sourceColumn: requiredCell(row, 'source_column'),
			fhirPath: requiredCell(row, 'fhir_path'),
			dataType: requiredCell(row, 'data_type'),
			isRequired: parseBoolean(requiredCell(row, 'is_required')),
			transformKind: parseTransformKind(requiredCell(row, 'transform_kind')),
			mappingKey: optionalCell(row, 'mapping_key'),
			referenceTarget: optionalCell(row, 'reference_target'),
			sortOrder: parseInteger(requiredCell(row, 'sort_order')),
			isActive: parseBoolean(requiredCell(row, 'is_active')),
		})),
		resourceProfiles: resourceProfiles.map((row) => ({
			igName: requiredCell(row, 'ig_name'),
			igVersion: requiredCell(row, 'ig_version'),
			resourceType: requiredCell(row, 'resource_type'),
			profileUrl: requiredCell(row, 'profile_url'),
			isActive: parseBoolean(requiredCell(row, 'is_active')),
		})),
		codeMappings: codeMappings.flat().map((row) => ({
			mappingKey: requiredCell(row, '__mapping_key'),
			sourceCode: requiredCell(row, 'source_code'),
			targetCode: requiredCell(row, 'target_code'),
			targetDisplay: optionalCell(row, 'target_display'),
			targetSystem: requiredCell(row, 'target_system'),
			displayZhTw: optionalCell(row, 'display_zh_tw'),
			isActive: parseBoolean(requiredCell(row, 'is_active')),
		})),
	};
}

function normalizeScenarioDocument(document: Record<string, unknown>): ScenarioRecord {
	const normalized = normalizeScenario(document as ScenarioDocument);
	const { summary, details, level } = document;
	const normalizedLevel = 'level' in normalized && isScenarioLevel(normalized.level) ? normalized.level : undefined;

	return {
		id: normalized.id,
		displayName: normalized.displayName,
		type: normalized.type,
		summary: typeof summary === 'string' ? summary : normalized.summary,
		details: typeof details === 'string' ? details : normalized.details,
		level: normalizedLevel ?? (isScenarioLevel(level) ? level : undefined),
		selection: normalized.selection,
		resources: normalized.resources as Record<string, Record<string, unknown>>,
	};
}

function isScenarioLevel(value: unknown): value is ScenarioLevel {
	return typeof value === 'number' && Number.isInteger(value);
}

type CsvRow = Record<string, string>;

async function loadCsv(filePath: string): Promise<CsvRow[]> {
	const content = await readFile(filePath, 'utf8');
	return parseCsv(content);
}

async function loadCsvDirectory(directoryPath: string): Promise<CsvRow[][]> {
	const entries = await readdir(directoryPath, { withFileTypes: true });
	const csvFiles = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith('.csv'))
		.map((entry) => path.join(directoryPath, entry.name))
		.sort();

	return Promise.all(
		csvFiles.map(async (filePath) =>
			(await loadCsv(filePath)).map((row) => ({
				...row,
				__mapping_key: path.basename(filePath, '.csv'),
			})),
		),
	);
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
		const char = line[index];
		const next = line[index + 1];

		if (char === '"') {
			if (inQuotes && next === '"') {
				current += '"';
				index += 1;
				continue;
			}

			inQuotes = !inQuotes;
			continue;
		}

		if (char === ',' && !inQuotes) {
			values.push(current);
			current = '';
			continue;
		}

		current += char;
	}

	values.push(current);
	return values.map((value) => value.trim());
}

function requiredCell(row: CsvRow, key: string): string {
	const value = row[key];

	if (!value) {
		throw new Error(`Missing required CSV value for "${key}".`);
	}

	return value;
}

function optionalCell(row: CsvRow, key: string): string | undefined {
	const value = row[key];
	return value ? value : undefined;
}

function parseBoolean(value: string): boolean {
	if (value === 'true') {
		return true;
	}

	if (value === 'false') {
		return false;
	}

	throw new Error(`Invalid boolean value "${value}".`);
}

function parseInteger(value: string): number {
	const parsed = Number.parseInt(value, 10);

	if (Number.isNaN(parsed)) {
		throw new Error(`Invalid integer value "${value}".`);
	}

	return parsed;
}

function parseTransformKind(value: string): 'copy' | 'code_map' | 'build_reference' {
	if (value === 'copy' || value === 'code_map' || value === 'build_reference') {
		return value;
	}

	throw new Error(`Unsupported transform kind "${value}".`);
}
