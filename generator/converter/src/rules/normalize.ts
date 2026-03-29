import type {
	CodeMappingRow,
	ConverterRuleSet,
	GeneratorRuleRow,
	ResourceProfileRow,
	StaticConverterRows,
} from '../types.js';

/**
 * Indexes raw static rows for fast resource conversion lookups.
 */
export function normalizeRuleSet(rows: StaticConverterRows, igName: string, igVersion: string): ConverterRuleSet {
	return {
		generatorRulesByResourceType: groupGeneratorRules(rows.generatorRules, igName, igVersion),
		resourceProfilesByResourceType: groupResourceProfiles(rows.resourceProfiles, igName, igVersion),
		codeMappingsByKey: groupCodeMappings(rows.codeMappings),
	};
}

function groupGeneratorRules(
	rows: GeneratorRuleRow[],
	igName: string,
	igVersion: string,
): Map<string, GeneratorRuleRow[]> {
	const grouped = new Map<string, GeneratorRuleRow[]>();

	for (const row of rows) {
		if (!row.isActive || row.igName !== igName || row.igVersion !== igVersion) {
			continue;
		}

		const entries = grouped.get(row.resourceType) ?? [];
		entries.push(row);
		grouped.set(row.resourceType, entries);
	}

	for (const [resourceType, entries] of grouped.entries()) {
		grouped.set(
			resourceType,
			[...entries].sort((left, right) => left.sortOrder - right.sortOrder),
		);
	}

	return grouped;
}

function groupResourceProfiles(
	rows: ResourceProfileRow[],
	igName: string,
	igVersion: string,
): Map<string, ResourceProfileRow> {
	const grouped = new Map<string, ResourceProfileRow>();

	for (const row of rows) {
		if (!row.isActive || row.igName !== igName || row.igVersion !== igVersion) {
			continue;
		}

		grouped.set(row.resourceType, row);
	}

	return grouped;
}

function groupCodeMappings(rows: CodeMappingRow[]): Map<string, Map<string, CodeMappingRow[]>> {
	const grouped = new Map<string, Map<string, CodeMappingRow[]>>();

	for (const row of rows) {
		if (!row.isActive) {
			continue;
		}

		const bySource = grouped.get(row.mappingKey) ?? new Map<string, CodeMappingRow[]>();
		const entries = bySource.get(row.sourceCode) ?? [];
		entries.push(row);
		bySource.set(row.sourceCode, entries);
		grouped.set(row.mappingKey, bySource);
	}

	return grouped;
}
