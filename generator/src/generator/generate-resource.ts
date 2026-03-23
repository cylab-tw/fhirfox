import type { CodeMapping, FhirResource, GeneratorRule, GeneratorValue, SourceRecord, SourceRow } from './types.js';
import type { GeneratorRepository } from '../repositories/generator-repository.js';

type FhirPrimitive = string | boolean;

interface TransformedValue {
	value: FhirPrimitive;
	siblingAssignments: Array<{
		fhirPath: string;
		value: FhirPrimitive;
	}>;
}

function buildMappingIndex(mappings: CodeMapping[]): Map<string, Map<string, CodeMapping>> {
	const index = new Map<string, Map<string, CodeMapping>>();

	for (const mapping of mappings) {
		let group = index.get(mapping.mappingKey);
		if (!group) {
			group = new Map<string, CodeMapping>();
			index.set(mapping.mappingKey, group);
		}
		group.set(mapping.sourceCode, mapping);
	}

	return index;
}

function normalizeBooleanValue(rawValue: GeneratorValue, fhirPath: string): boolean {
	if (typeof rawValue === 'boolean') {
		return rawValue;
	}

	const normalized = rawValue.trim().toLowerCase();
	if (['true', 't', '1', 'yes', 'y'].includes(normalized)) {
		return true;
	}

	if (['false', 'f', '0', 'no', 'n'].includes(normalized)) {
		return false;
	}

	throw new Error(`Invalid boolean value "${rawValue}" for ${fhirPath}`);
}

function normalizeDateValue(rawValue: GeneratorValue, fhirPath: string): string {
	if (typeof rawValue !== 'string') {
		throw new Error(`Expected a date string for ${fhirPath}`);
	}

	const normalized = rawValue.trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
		return normalized;
	}

	const parsed = new Date(normalized);
	if (Number.isNaN(parsed.valueOf())) {
		throw new Error(`Invalid date value "${rawValue}" for ${fhirPath}`);
	}

	return parsed.toISOString().slice(0, 10);
}

function normalizeDateTimeValue(rawValue: GeneratorValue, fhirPath: string): string {
	if (typeof rawValue !== 'string') {
		throw new Error(`Expected a datetime string for ${fhirPath}`);
	}

	const parsed = new Date(rawValue);
	if (Number.isNaN(parsed.valueOf())) {
		throw new Error(`Invalid datetime value "${rawValue}" for ${fhirPath}`);
	}

	return parsed.toISOString();
}

function normalizeByDataType(rule: GeneratorRule, rawValue: GeneratorValue): FhirPrimitive {
	switch (rule.dataType) {
		case 'boolean':
			return normalizeBooleanValue(rawValue, rule.fhirPath);
		case 'date':
			return normalizeDateValue(rawValue, rule.fhirPath);
		case 'dateTime':
			return normalizeDateTimeValue(rawValue, rule.fhirPath);
		default:
			if (typeof rawValue === 'boolean') {
				return String(rawValue);
			}
			return rawValue;
	}
}

function buildCodeMapAssignments(rule: GeneratorRule, mapping: CodeMapping): TransformedValue {
	const siblingAssignments: TransformedValue['siblingAssignments'] = [];

	if (rule.fhirPath.endsWith('.code')) {
		const basePath = rule.fhirPath.slice(0, -'.code'.length);
		siblingAssignments.push({
			fhirPath: `${basePath}.system`,
			value: mapping.targetSystem,
		});

		if (mapping.targetDisplay) {
			siblingAssignments.push({
				fhirPath: `${basePath}.display`,
				value: mapping.targetDisplay,
			});
		}
	}

	return {
		value: mapping.targetCode,
		siblingAssignments,
	};
}

function transformValue(
	rule: GeneratorRule,
	rawValue: GeneratorValue,
	mappings: Map<string, Map<string, CodeMapping>>,
): TransformedValue {
	if (rule.transformKind === 'copy') {
		return {
			value: normalizeByDataType(rule, rawValue),
			siblingAssignments: [],
		};
	}

	if (rule.transformKind === 'build_reference') {
		if (!rule.referenceTarget) {
			throw new Error(`Missing reference target for ${rule.fhirPath}`);
		}
		return {
			value: `${rule.referenceTarget}/${String(rawValue)}`,
			siblingAssignments: [],
		};
	}

	if (!rule.mappingKey) {
		throw new Error(`Missing mapping key for ${rule.fhirPath}`);
	}

	const mapping = mappings.get(rule.mappingKey)?.get(String(rawValue));
	if (!mapping) {
		throw new Error(`No mapping found for ${rule.mappingKey} with source code "${rawValue}"`);
	}

	return buildCodeMapAssignments(rule, mapping);
}

function parsePathSegment(segment: string): {
	key: string;
	qualifier: string | null;
	arrayMode: 'none' | 'source-row' | 'fixed';
	arrayIndex: number | null;
} {
	const [rawKey, qualifier] = segment.split(':');
	const match = rawKey.match(/^([A-Za-z][A-Za-z0-9_]*)(?:\[(\d*)\])?$/);

	if (!match) {
		throw new Error(`Unsupported FHIR path segment "${segment}"`);
	}

	const [, key, indexValue] = match;

	return {
		key,
		qualifier: qualifier ?? null,
		arrayMode: indexValue === undefined ? 'none' : indexValue === '' ? 'source-row' : 'fixed',
		arrayIndex: indexValue === undefined || indexValue === '' ? null : Number(indexValue),
	};
}

function ensureObject(parent: Record<string, unknown>, key: string): Record<string, unknown> {
	const existing = parent[key];
	if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
		return existing as Record<string, unknown>;
	}

	const next: Record<string, unknown> = {};
	parent[key] = next;
	return next;
}

function ensureArrayItem(parent: Record<string, unknown>, key: string, index: number): Record<string, unknown> {
	const existing = parent[key];
	const array = Array.isArray(existing) ? existing : [];
	parent[key] = array;

	const item = array[index];
	if (item && typeof item === 'object' && !Array.isArray(item)) {
		return item as Record<string, unknown>;
	}

	const next: Record<string, unknown> = {};
	array[index] = next;
	return next;
}

function ensureArray(parent: Record<string, unknown>, key: string): unknown[] {
	const existing = parent[key];
	if (Array.isArray(existing)) {
		return existing;
	}

	const next: unknown[] = [];
	parent[key] = next;
	return next;
}

function applyPathValue(
	resource: FhirResource,
	rule: GeneratorRule,
	value: FhirPrimitive,
	sourceRowIndex: number,
): void {
	const prefix = `${rule.resourceType}.`;
	if (!rule.fhirPath.startsWith(prefix)) {
		throw new Error(`Rule path ${rule.fhirPath} does not match ${rule.resourceType}`);
	}

	const relativePath = rule.fhirPath.slice(prefix.length);
	const segments = relativePath.split('.');
	let current: Record<string, unknown> = resource;

	for (const [segmentIndex, rawSegment] of segments.entries()) {
		const { key, qualifier, arrayMode, arrayIndex } = parsePathSegment(rawSegment);
		const isLast = segmentIndex === segments.length - 1;

		if (arrayMode !== 'none') {
			const resolvedIndex = arrayMode === 'source-row' ? sourceRowIndex : (arrayIndex ?? 0);

			if (isLast) {
				const array = ensureArray(current, key);
				array[resolvedIndex] = value;
				return;
			}

			const item = ensureArrayItem(current, key, resolvedIndex);

			if (qualifier) {
				item.use = qualifier;
			}

			current = item;
			continue;
		}

		if (isLast) {
			current[key] = value;
			return;
		}

		current = ensureObject(current, key);
	}
}

function getRuleValues(record: SourceRecord, rule: GeneratorRule): GeneratorValue[] {
	const rows = record.tables[rule.sourceTable] ?? [];
	return rows
		.map((row: SourceRow) => row[rule.sourceColumn])
		.filter((value): value is GeneratorValue => value !== undefined && value !== null && value !== '');
}

export async function generateResourceByRules(
	params: {
		igName: string;
		igVersion: string;
		resourceType: string;
		id: string;
	},
	repository: GeneratorRepository,
): Promise<FhirResource | null> {
	const rules = await repository.getRules({
		igName: params.igName,
		igVersion: params.igVersion,
		resourceType: params.resourceType,
	});

	if (rules.length === 0) {
		throw new Error(`No rules found for resource type ${params.resourceType}`);
	}

	const mappingKeys = [...new Set(rules.flatMap((rule) => (rule.mappingKey ? [rule.mappingKey] : [])))];
	const [resourceProfile, record, mappings] = await Promise.all([
		repository.getResourceProfile({
			igName: params.igName,
			igVersion: params.igVersion,
			resourceType: params.resourceType,
		}),
		repository.getSourceRecord({
			resourceType: params.resourceType,
			id: params.id,
			sourceTables: rules.map((rule) => rule.sourceTable),
		}),
		repository.getMappings(mappingKeys),
	]);

	if (!record) {
		return null;
	}

	const mappingIndex = buildMappingIndex(mappings);
	const resource: FhirResource = {
		resourceType: params.resourceType,
		id: record.logicalId,
	};

	if (resourceProfile) {
		resource.meta = {
			profile: [resourceProfile.profileUrl],
		};
	}

	for (const rule of [...rules].sort((a, b) => a.sortOrder - b.sortOrder)) {
		const tableRows = record.tables[rule.sourceTable] ?? [];
		const values = getRuleValues(record, rule);

		if (rule.isRequired && values.length === 0) {
			throw new Error(`Missing required value for ${rule.fhirPath}`);
		}

		for (const [rowIndex, row] of tableRows.entries()) {
			const rawValue = row[rule.sourceColumn];
			if (rawValue === undefined || rawValue === null || rawValue === '') {
				continue;
			}

			const transformedValue = transformValue(rule, rawValue, mappingIndex);
			applyPathValue(resource, rule, transformedValue.value, rowIndex);

			for (const siblingAssignment of transformedValue.siblingAssignments) {
				applyPathValue(
					resource,
					{
						...rule,
						fhirPath: siblingAssignment.fhirPath,
					},
					siblingAssignment.value,
					rowIndex,
				);
			}
		}
	}

	return resource;
}
