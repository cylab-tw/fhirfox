import { readFile, readdir } from 'node:fs/promises';
import { parse } from 'yaml';
import path from 'node:path';

import {
	assembleBundle,
	attachInternalSourceResourceType,
	convertResource,
	determineFhirMappingFromGeneratorRules,
	normalizeRuleSet,
	orderFhirResourceFields,
	orderSourceResourceFields,
	readSourceResourceType,
} from '@fhirfox/converter/browser';
import { compileResourceDefinitions, createInMemoryDatasetProvider, resolveScenario } from '@fhirfox-generator/dataset';

import type {
	BackendManifest,
	ResolvedScenarioResponse,
	ScenarioIndexRecord,
	ScenarioLevelDefinition,
	ScenarioRecord,
	ScenarioResourceMappingRecord,
	SourceCodeDisplayMap,
	SourceFieldDocRecord,
} from './types.js';
import type {
	ConverterRuleSet,
	GeneratorRuleRow,
	SourceResource,
	StaticConverterRows,
} from '@fhirfox/converter/browser';
import type { DatasetProvider, Preset, ResourceTypeDefinition, ScenarioDefinition } from '@fhirfox-generator/dataset';

const IG_NAME = 'tw.gov.mohw.twcore';
const IG_VERSION = '1.0.0';

export interface BackendCatalog {
	resourceTypeDefinitions: ResourceTypeDefinition[];
	presets: Preset[];
	scenarios: ScenarioDefinition[];
	levelDefinitions: ScenarioLevelDefinition[];
	sourceFieldDocs: Record<string, SourceFieldDocRecord>;
	sourceCodeDisplayMap: SourceCodeDisplayMap;
	scenarioIndex: ScenarioIndexRecord;
	provider: DatasetProvider;
	ruleSet: ConverterRuleSet;
	igName: string;
	igVersion: string;
}

export async function loadBackendCatalog(repoRoot: string): Promise<BackendCatalog> {
	const datasetRoot = path.join(repoRoot, 'dataset');
	const resourceTypeDefinitions = await loadResourceDefinitions(path.join(datasetRoot, 'definitions'));
	const presets = await loadPresets(path.join(datasetRoot, 'presets'));
	const scenarios = await loadScenarios(path.join(repoRoot, 'scenarios'));
	const levelDefinitions = await loadScenarioLevelDefinitions(path.join(datasetRoot, 'scenarios', 'levels.json'));
	const converterRows = await loadConverterRows(path.join(datasetRoot, 'converter'), IG_NAME);
	const { docs: sourceFieldDocs, order: sourceFieldOrder } = buildSourceFieldDocs(resourceTypeDefinitions, {
		converterRows,
		igName: IG_NAME,
		igVersion: IG_VERSION,
	});
	const sourceCodeDisplayMap = buildSourceCodeDisplayMap(converterRows);
	const provider = createInMemoryDatasetProvider({
		resourceTypeDefinitions,
		presets,
		codeMappings: converterRows.codeMappings,
	});
	const ruleSet = normalizeRuleSet(converterRows, IG_NAME, IG_VERSION);
	ruleSet.sourceFieldOrder = sourceFieldOrder;

	return {
		resourceTypeDefinitions,
		presets,
		scenarios,
		levelDefinitions,
		sourceFieldDocs,
		sourceCodeDisplayMap,
		scenarioIndex: {
			generatedAt: new Date().toISOString(),
			scenarioSource: 'backend',
			levelDefinitions,
			scenarios: scenarios.map(toScenarioRecord),
		},
		provider,
		ruleSet,
		igName: IG_NAME,
		igVersion: IG_VERSION,
	};
}

export async function resolveBackendScenario(
	catalog: BackendCatalog,
	scenarioId: string,
	options: { seed: string; generatedAt?: string; now?: Date },
): Promise<ResolvedScenarioResponse> {
	const scenario = catalog.scenarios.find((entry) => entry.id === scenarioId);

	if (!scenario) {
		throw new Error(`Unknown scenario "${scenarioId}".`);
	}

	const generatedAt = options.generatedAt ?? new Date().toISOString();
	const resolved = await resolveScenario(catalog.provider, scenario, {
		seed: options.seed,
		generatedAt,
		now: options.now ?? new Date(generatedAt),
	});
	const orderedResources = resolved.resources.map((resource) => {
		const typedResource = attachInternalSourceResourceType(resource.resource, resource.resourceType);
		return attachInternalSourceResourceType(
			orderSourceResourceFields(typedResource, catalog.ruleSet),
			resource.resourceType,
		);
	});
	const groupedResources = groupSourceResources(orderedResources);
	const bundleResources = resolved.resources.map((resource) =>
		orderFhirResourceFields(
			convertResource(resource.resource, catalog.ruleSet, {
				igName: catalog.igName,
				igVersion: catalog.igVersion,
			}),
			resource.resourceType,
			catalog.ruleSet,
		),
	);
	const sourceKeys = orderedResources.map((resource, index) => createSourceResourceKey(resource, index));

	return {
		generation: {
			id: '',
			scenarioId: scenario.id,
			userId: 'anonymous',
			seed: options.seed,
			requestedAt: generatedAt,
			generatedAt,
		},
		result: {
			scenarioId: scenario.id,
			resources: groupedResources,
			orderedResources,
			graph: resolved.graph,
			warnings: resolved.warnings.length > 0 ? resolved.warnings.map((warning) => warning.message) : undefined,
			meta: {
				directMatchCount: resolved.metadata.stats.explicitResourceCount,
				expandedMatchCount: resolved.metadata.stats.resourceCount,
				totalResources: orderedResources.length,
			},
		},
		bundle: attachScenarioResourceMapping(assembleBundle(bundleResources, {}), {
			orderedSourceKeys: sourceKeys,
			bundleEntrySourceKeys: sourceKeys,
		}),
		mapping: {
			orderedSourceKeys: sourceKeys,
			bundleEntrySourceKeys: sourceKeys,
		},
	};
}

export function createBackendManifest(apiBaseUrl: string, defaultSeed = '1234'): BackendManifest {
	return {
		generatedAt: new Date().toISOString(),
		dataSource: {
			kind: 'backend',
			apiBaseUrl,
			defaultSeed,
		},
	};
}

interface BuildSourceFieldDocsOptions {
	converterRows: StaticConverterRows;
	igName: string;
	igVersion: string;
}

function buildSourceFieldDocs(
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

	return { docs, order };
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

function buildSourceCodeDisplayMap(rows: Awaited<ReturnType<typeof loadConverterRows>>): SourceCodeDisplayMap {
	const mappingKeyByField = new Map(
		rows.generatorRules.flatMap((row) =>
			row.transformKind === 'code_map' && row.mappingKey ? [[row.path.toLowerCase(), row.mappingKey] as const] : [],
		),
	);
	const displayMap: SourceCodeDisplayMap = {};

	for (const row of rows.codeMappings) {
		const displayValue = row.displayZhTw ?? row.targetDisplay;

		if (!displayValue) {
			continue;
		}

		for (const [fieldPath, mappingKey] of mappingKeyByField.entries()) {
			if (mappingKey !== row.mappingKey) {
				continue;
			}

			displayMap[`${fieldPath}:${row.sourceCode}`] = displayValue;
		}
	}

	for (const row of rows.codeMappings) {
		const displayValue = row.displayZhTw ?? row.targetDisplay;

		if (row.mappingKey !== 'laboratoryresult-lab-code' || !displayValue) {
			continue;
		}

		displayMap[`observation.observationcode:${row.sourceCode}`] = displayValue;
	}

	return displayMap;
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

function groupSourceResources(resources: SourceResource[]): Record<string, SourceResource[]> {
	const grouped: Record<string, SourceResource[]> = {};

	for (const resource of resources) {
		const resourceType = readSourceResourceType(resource);
		grouped[resourceType] ??= [];
		grouped[resourceType].push(resource);
	}

	return grouped;
}

function createSourceResourceKey(resource: SourceResource, index: number): string {
	return `${readSourceResourceType(resource).toLowerCase()}/${resource.id ?? `index-${index + 1}`}`;
}

function attachScenarioResourceMapping<T extends object>(target: T, mapping: ScenarioResourceMappingRecord): T {
	Object.defineProperty(target, '__resourceMapping', {
		value: mapping,
		enumerable: false,
		configurable: true,
		writable: false,
	});

	return target;
}

function toScenarioRecord(scenario: ScenarioDefinition): ScenarioRecord {
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

async function loadResourceDefinitions(directoryPath: string): Promise<ResourceTypeDefinition[]> {
	return compileResourceDefinitions({
		definitions: await loadYamlDirectory<ResourceTypeDefinition>(directoryPath),
	}).resourceTypeDefinitions;
}

async function loadPresets(directoryPath: string): Promise<Preset[]> {
	return loadYamlDirectory<Preset>(directoryPath);
}

async function loadScenarios(scenariosDir: string): Promise<ScenarioDefinition[]> {
	try {
		return loadYamlDirectory<ScenarioDefinition>(scenariosDir);
	} catch {
		return [];
	}
}

async function loadScenarioLevelDefinitions(filePath: string): Promise<ScenarioLevelDefinition[]> {
	const content = await readFile(filePath, 'utf8');

	if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
		return parse(content) as ScenarioLevelDefinition[];
	}

	return JSON.parse(content) as ScenarioLevelDefinition[];
}

async function loadConverterRows(converterDir: string, igName: string): Promise<StaticConverterRows> {
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
