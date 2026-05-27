import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import type {
	CodeMappingRow,
	GeneratorRuleRow,
	ResourceProfileRow,
	StaticConverterRows,
	TransformKind,
} from '../types.js';

/**
 * Loads static converter rows from the dataset-owned CSV assets.
 */
export async function loadStaticConverterRows(baseDir: string, igName: string): Promise<StaticConverterRows> {
	const [generatorRulesCsv, codeMappingsCsvFiles, resourceProfilesCsv] = await Promise.all([
		readCsvFile(path.join(baseDir, 'generator-rules', `${igName}.csv`)),
		readCsvDirectory(path.join(baseDir, 'code-mappings')),
		readCsvFile(path.join(baseDir, 'resource-profiles.csv')),
	]);

	return {
		generatorRules: generatorRulesCsv.map(parseGeneratorRuleRow),
		codeMappings: codeMappingsCsvFiles.flat().map(parseCodeMappingRow),
		resourceProfiles: resourceProfilesCsv.map(parseResourceProfileRow),
	};
}

function parseGeneratorRuleRow(row: CsvRow): GeneratorRuleRow {
	return {
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
	};
}

function parseResourceProfileRow(row: CsvRow): ResourceProfileRow {
	return {
		igName: requiredCell(row, 'ig_name'),
		igVersion: requiredCell(row, 'ig_version'),
		resourceType: requiredCell(row, 'resource_type'),
		profileUrl: requiredCell(row, 'profile_url'),
		matchFhirPath: optionalCell(row, 'match_fhir_path'),
		matchValue: optionalCell(row, 'match_value'),
		isActive: parseBoolean(requiredCell(row, 'is_active')),
	};
}

function parseCodeMappingRow(row: CsvRow): CodeMappingRow {
	return {
		mappingKey: requiredCell(row, '__mapping_key'),
		sourceCode: requiredCell(row, 'source_code'),
		targetCode: requiredCell(row, 'target_code'),
		targetDisplay: optionalCell(row, 'target_display'),
		targetSystem: requiredCell(row, 'target_system'),
		displayZhTw: optionalCell(row, 'display_zh_tw'),
		isActive: parseBoolean(requiredCell(row, 'is_active')),
	};
}

async function readCsvFile(filePath: string): Promise<CsvRow[]> {
	const content = await readFile(filePath, 'utf8');
	return parseCsv(content);
}

async function readCsvDirectory(directoryPath: string): Promise<CsvRow[][]> {
	const entries = await readdir(directoryPath, { withFileTypes: true });
	const csvFiles = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith('.csv'))
		.map((entry) => path.join(directoryPath, entry.name))
		.sort();

	return Promise.all(
		csvFiles.map(async (filePath) =>
			(await readCsvFile(filePath)).map((row) => ({
				...row,
				__mapping_key: path.basename(filePath, '.csv'),
			})),
		),
	);
}

type CsvRow = Record<string, string>;

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

function parseTransformKind(value: string): TransformKind {
	if (value === 'copy' || value === 'code_map' || value === 'build_reference' || value === 'constant') {
		return value;
	}

	throw new Error(`Unsupported transform kind "${value}".`);
}
