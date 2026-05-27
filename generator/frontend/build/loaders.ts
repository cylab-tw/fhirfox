import { readFile, readdir } from 'node:fs/promises';
import { parse } from 'yaml';
import path from 'node:path';
import { compileResourceDefinitions } from '../../dataset/src/index.ts';
import { determineFhirMappingFromGeneratorRules } from '../../converter/src/browser.ts';

import type { Preset, ResourceTypeDefinition, ScenarioDefinition } from '../../dataset/src/index.ts';
import type { ScenarioLevelDefinition, ScenarioRecord, SourceFieldDocRecord } from './types.js';
import type { GeneratorRuleRow, StaticConverterRows } from '../../converter/src/browser.ts';

export interface BuildSourceFieldDocsOptions {
	converterRows: StaticConverterRows;
	igName: string;
	igVersion: string;
}

export function buildSourceFieldDocs(
	definitions: ResourceTypeDefinition[],
	options: BuildSourceFieldDocsOptions,
): {
	docs: Record<string, SourceFieldDocRecord>;
	order: Record<string, string[]>;
} {
	const docs: Record<string, SourceFieldDocRecord> = {};
	const order: Record<string, string[]> = {};

	for (const definition of definitions) {
		docs[definition.resourceType] = {
			description: definition.summary,
			cardinality: '0..*',
			required: false,
		};
		order[definition.resourceType] = definition.fields.map((field) => field.id);

		for (const field of definition.fields) {
			const fieldRules = findFieldRules(options.converterRows.generatorRules, {
				igName: options.igName,
				igVersion: options.igVersion,
				resourceType: definition.resourceType,
				path: field.path,
			});
			const doc = {
				description: field.summary,
				cardinality: field.cardinality,
				required: field.required,
				fhirMapping: determineFhirMappingFromGeneratorRules(options.converterRows.generatorRules, {
					igName: options.igName,
					igVersion: options.igVersion,
					resourceType: definition.resourceType,
					path: field.path,
				}),
				reference: readDocReference(definition, field),
			};
			const sourceKeys = new Set([`${definition.resourceType}.${field.id}`, field.path]);

			for (const key of sourceKeys) {
				docs[key] = doc;
			}

			for (const rule of fieldRules) {
				docs[normalizeFhirDocPath(rule.fhirPath)] = {
					...doc,
					reference: readRuleReference(rule) ?? doc.reference,
				};
			}
		}
	}

	return {
		docs,
		order,
	};
}

function findFieldRules(
	rules: GeneratorRuleRow[],
	options: {
		igName: string;
		igVersion: string;
		resourceType: string;
		path: string;
	},
): GeneratorRuleRow[] {
	return rules
		.filter(
			(rule) =>
				rule.isActive &&
				rule.igName === options.igName &&
				rule.igVersion === options.igVersion &&
				rule.resourceType.toLowerCase() === options.resourceType.toLowerCase() &&
				rule.path === options.path,
		)
		.sort((left, right) => left.sortOrder - right.sortOrder);
}

function readRuleReference(rule: GeneratorRuleRow): string | undefined {
	return rule.transformKind === 'build_reference' && rule.referenceTarget
		? rule.referenceTarget.toLowerCase()
		: undefined;
}

function normalizeFhirDocPath(fhirPath: string): string {
	const [resourceType, ...segments] = fhirPath.split('.');
	const normalizedSegments = segments.map((segment) => segment.replace(/\[\d+\]/gu, '').replace(/:.+$/u, ''));
	return [resourceType?.toLowerCase(), ...normalizedSegments].filter(Boolean).join('.');
}

export async function loadResourceDefinitions(directoryPath: string): Promise<ResourceTypeDefinition[]> {
	return compileResourceDefinitions({
		definitions: await loadYamlDirectory<ResourceTypeDefinition>(directoryPath),
	}).resourceTypeDefinitions;
}

export async function loadPresets(directoryPath: string): Promise<Preset[]> {
	return loadYamlDirectory<Preset>(directoryPath);
}

export async function loadScenarios(scenariosDir: string): Promise<ScenarioDefinition[]> {
	try {
		return loadYamlDirectory<ScenarioDefinition>(scenariosDir);
	} catch {
		return [];
	}
}

export function toScenarioRecord(scenario: ScenarioDefinition): ScenarioRecord {
	return {
		id: scenario.id,
		displayName: scenario.name,
		type: scenario.scenarioType ?? 'unknown',
		summary: scenario.summary,
		details: scenario.details,
		level: scenario.level,
		resources: {},
	};
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
			path: requiredCell(row, 'path'),
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
			matchFhirPath: optionalCell(row, 'match_fhir_path'),
			matchValue: optionalCell(row, 'match_value'),
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

async function loadYamlDirectory<T>(directoryPath: string): Promise<T[]> {
	const yamlFiles = await listYamlFiles(directoryPath);

	return Promise.all(
		yamlFiles.map(async (filePath) => {
			const content = await readFile(filePath, 'utf8');
			return parse(content) as T;
		}),
	);
}

async function listYamlFiles(directoryPath: string): Promise<string[]> {
	const entries = await readdir(directoryPath, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const filePath = path.join(directoryPath, entry.name);
			if (entry.isDirectory()) {
				return listYamlFiles(filePath);
			}
			return entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) ? [filePath] : [];
		}),
	);

	return files.flat().sort();
}

function readDocReference(
	definition: ResourceTypeDefinition,
	field: ResourceTypeDefinition['fields'][number],
): string | string[] | undefined {
	const bindingId = field.reference?.binding;
	if (!bindingId) {
		return undefined;
	}

	const resourceTypes = definition.bindings?.[bindingId]?.resourceTypes ?? [];

	if (resourceTypes.length === 0) {
		return undefined;
	}

	return resourceTypes.length === 1 ? resourceTypes[0] : resourceTypes;
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

function parseTransformKind(value: string): 'copy' | 'code_map' | 'build_reference' | 'constant' {
	if (value === 'copy' || value === 'code_map' || value === 'build_reference' || value === 'constant') {
		return value;
	}

	throw new Error(`Unsupported transform kind "${value}".`);
}
