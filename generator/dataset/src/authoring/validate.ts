import { deriveResourceLinks } from './source-fields.js';
import { normalizeScenario } from '../scenario/scenario.js';
import { validateScenarioDocument } from '../scenario/index.js';

import type {
	AuthoredLinkRecord,
	AuthoredScenarioDocument,
	AuthoredSourceResource,
	CodeMappingRecord,
	DatasetAuthoringInput,
	DatasetValidationIssue,
	DatasetValidationReport,
	GeneratorRuleMappingRecord,
	SourceAuthoringSchema,
} from './contracts.js';

export function validateDatasetAuthoring(input: DatasetAuthoringInput): DatasetValidationReport {
	const links = input.links ?? deriveAuthoredLinksFromSchema(input.schema);
	const issues: DatasetValidationIssue[] = [
		...validateSourceResources(input.schema, input.resources, input.codeMappings, input.generatorRuleMappings),
		...validateScenarios(input.scenarios, input.resources),
		...validateLinks(input.schema, links),
		...validateMappingCoverage(input.codeMappings, input.generatorRuleMappings),
	];

	return {
		issues,
		errorCount: issues.filter((issue) => issue.severity === 'error').length,
		warningCount: issues.filter((issue) => issue.severity === 'warning').length,
	};
}

function validateSourceResources(
	schema: SourceAuthoringSchema,
	resources: AuthoredSourceResource[],
	codeMappings: CodeMappingRecord[],
	generatorRuleMappings: GeneratorRuleMappingRecord[],
): DatasetValidationIssue[] {
	const issues: DatasetValidationIssue[] = [];
	const resourcesByTypeAndId = buildResourceLookup(resources);
	const mappingKeyByField = new Map(
		generatorRuleMappings.flatMap((row) =>
			row.mappingKey ? [[`${row.resourceType}.${row.sourceColumn}`, row.mappingKey] as const] : [],
		),
	);

	for (const resource of resources) {
		const model = schema.models[resource.resourceType];

		if (!model) {
			issues.push(error('resource.unknownType', resource.path, `Unknown resource type "${resource.resourceType}".`));
			continue;
		}

		for (const key of Object.keys(resource.value)) {
			if (!(key in model.fields)) {
				issues.push(
					error(
						'resource.unknownField',
						`${resource.path}#${key}`,
						`Unknown field "${key}" for ${resource.resourceType}.`,
						'Add the field to the resource model YAML or remove it from the source JSON.',
					),
				);
			}
		}

		for (const [field, definition] of Object.entries(model.fields)) {
			const value = resource.value[field];

			if (definition.required && isEmpty(value)) {
				issues.push(
					error(
						'resource.missingRequiredField',
						`${resource.path}#${field}`,
						`Missing required field "${field}" for ${resource.resourceType}.`,
					),
				);
			}

			if (definition.reference && typeof value === 'string' && value.length > 0) {
				const allowedTargetTypes = normalizeReferenceTypes(definition.reference);
				const referenceTypeField = getReferenceTypeFieldName(field);
				const explicitReferenceType = readNonEmptyString(resource.value[referenceTypeField]);
				const matchingTargetTypes = allowedTargetTypes.filter((targetType) =>
					resourcesByTypeAndId.has(`${targetType}/${value}`),
				);

				if (explicitReferenceType && !allowedTargetTypes.includes(explicitReferenceType)) {
					issues.push(
						error(
							'resource.invalidReferenceType',
							`${resource.path}#${referenceTypeField}`,
							`Reference type "${explicitReferenceType}" for field "${field}" is not one of: ${allowedTargetTypes.join(', ')}.`,
						),
					);
					continue;
				}

				if (matchingTargetTypes.length === 0) {
					issues.push(
						error(
							'resource.missingReference',
							`${resource.path}#${field}`,
							`Missing referenced ${allowedTargetTypes.join('|')}/${value} for field "${field}".`,
						),
					);
				}

				if (explicitReferenceType) {
					if (!resourcesByTypeAndId.has(`${explicitReferenceType}/${value}`)) {
						issues.push(
							error(
								'resource.missingTypedReference',
								`${resource.path}#${referenceTypeField}`,
								`Reference type "${explicitReferenceType}" for field "${field}" does not match any ${explicitReferenceType}/${value} resource.`,
							),
						);
					}
					continue;
				}

				if (matchingTargetTypes.length > 1) {
					issues.push(
						warning(
							'resource.ambiguousReference',
							`${resource.path}#${field}`,
							`Reference value "${value}" for field "${field}" matches multiple resource types: ${matchingTargetTypes.join(', ')}.`,
							`Add "${referenceTypeField}" to disambiguate the intended target type.`,
						),
					);
				}
			}

			const inferredMappingKey = mappingKeyByField.get(`${resource.resourceType}.${field}`);

			if (inferredMappingKey && isNonEmptyScalar(value)) {
				const hasMapping = codeMappings.some(
					(row) => row.mappingKey === inferredMappingKey && row.sourceCode === String(value),
				);

				if (!hasMapping) {
					issues.push(
						error(
							'resource.missingCodeMapping',
							`${resource.path}#${field}`,
							`Missing code mapping for "${resource.resourceType}.${field}" source code "${String(value)}".`,
							`Add a row for mapping key "${inferredMappingKey}" in dataset/converter/code-mappings.`,
						),
					);
				}
			}
		}
	}

	return issues;
}

function validateScenarios(
	scenarios: AuthoredScenarioDocument[],
	resources: AuthoredSourceResource[],
): DatasetValidationIssue[] {
	const issues: DatasetValidationIssue[] = [];

	for (const scenario of scenarios) {
		for (const issue of validateScenarioDocument(scenario.document)) {
			issues.push({ ...issue, path: `${scenario.path}#${issue.path}` });
		}

		try {
			const normalized = normalizeScenario(scenario.document as import('../scenario/scenario.js').ScenarioDocument);
			const directMatchCounts = Object.entries(normalized.resources).map(([resourceType, selection]) => {
				const filters = Array.isArray(selection) ? selection : [selection];
				const deterministicFilters = filters.filter((filter) => isDeterministicScenarioFilter(filter));

				if (deterministicFilters.length === 0) {
					return 1;
				}

				return deterministicFilters.reduce(
					(count, filter) => count + queryDirectMatches(resources, resourceType, filter).length,
					0,
				);
			});

			if (directMatchCounts.length > 0 && directMatchCounts.every((count) => count === 0)) {
				issues.push(
					warning(
						'scenario.noDeterministicMatches',
						scenario.path,
						'Scenario has no deterministic direct matches in the current source dataset.',
						'Check filter values and source resource data.',
					),
				);
			}
		} catch (error) {
			issues.push(
				errorIssue(
					'scenario.normalizeFailed',
					scenario.path,
					error instanceof Error ? error.message : 'Scenario normalization failed.',
				),
			);
		}
	}

	return issues;
}

function validateLinks(schema: SourceAuthoringSchema, links: AuthoredLinkRecord[]): DatasetValidationIssue[] {
	const issues: DatasetValidationIssue[] = [];

	for (const link of links) {
		const sourceModel = schema.models[link.sourceType];

		if (!sourceModel) {
			issues.push(error('links.unknownSourceType', link.path, `Unknown link source type "${link.sourceType}".`));
		}

		const sourceField = sourceModel?.fields[link.field];

		if (!sourceField) {
			issues.push(
				error(
					'links.unknownField',
					link.path,
					`Link field "${link.field}" does not exist on source type "${link.sourceType}".`,
				),
			);
			continue;
		}

		const declaredReferenceTypes = normalizeReferenceTypes(sourceField.reference);
		const hasSupportedTargetType = link.targetTypes.some((targetType) => declaredReferenceTypes.includes(targetType));

		if (declaredReferenceTypes.length > 0 && !hasSupportedTargetType) {
			issues.push(
				warning(
					'links.referenceMismatch',
					link.path,
					`Link ${link.sourceType}.${link.field} does not include any of the field contract target types: ${declaredReferenceTypes.join(', ')}.`,
				),
			);
		}
	}

	return issues;
}

function deriveAuthoredLinksFromSchema(schema: SourceAuthoringSchema): AuthoredLinkRecord[] {
	return deriveResourceLinks(schema).map((link) => ({
		path: '[derived from definitions]',
		sourceType: link.sourceType,
		field: link.field,
		targetTypes: link.targetTypes,
	}));
}

function validateMappingCoverage(
	codeMappings: CodeMappingRecord[],
	generatorRuleMappings: GeneratorRuleMappingRecord[],
): DatasetValidationIssue[] {
	const issues: DatasetValidationIssue[] = [];
	const generatorRuleKeys = new Set(generatorRuleMappings.flatMap((row) => (row.mappingKey ? [row.mappingKey] : [])));

	for (const mappingKey of generatorRuleKeys) {
		if (!codeMappings.some((row) => row.mappingKey === mappingKey)) {
			issues.push(
				error('mapping.missingTable', mappingKey, `No code mapping rows found for mapping key "${mappingKey}".`),
			);
		}
	}

	const orphanMappingRowsByKey = new Map<string, CodeMappingRecord[]>();

	for (const row of codeMappings) {
		if (generatorRuleKeys.has(row.mappingKey)) {
			continue;
		}

		const rows = orphanMappingRowsByKey.get(row.mappingKey) ?? [];
		rows.push(row);
		orphanMappingRowsByKey.set(row.mappingKey, rows);
	}

	for (const [mappingKey, rows] of orphanMappingRowsByKey.entries()) {
		issues.push(
			warning(
				'mapping.orphanRow',
				rows[0]?.path ?? mappingKey,
				`Mapping key "${mappingKey}" is not referenced by any source field contract or generator rule.`,
			),
		);
	}

	return issues;
}

function buildResourceLookup(resources: AuthoredSourceResource[]): Map<string, AuthoredSourceResource> {
	return new Map(
		resources.map((resource) => [`${resource.resourceType}/${String(resource.value.id ?? '')}`, resource]),
	);
}

function normalizeReferenceTypes(reference: string | string[] | undefined): string[] {
	if (!reference) {
		return [];
	}

	return Array.isArray(reference) ? reference : [reference];
}

function getReferenceTypeFieldName(field: string): string {
	return field.endsWith('Id') ? `${field.slice(0, -2)}Type` : `${field}Type`;
}

function readNonEmptyString(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isEmpty(value: unknown): boolean {
	return value === undefined || value === null || value === '';
}

function isNonEmptyScalar(value: unknown): boolean {
	return (typeof value === 'string' && value.length > 0) || typeof value === 'number' || typeof value === 'boolean';
}

function isDeterministicScenarioFilter(filter: Record<string, unknown>): boolean {
	return Object.keys(filter).every(
		(key) => !['samePerson', 'samePersonEncounter', 'samePersonEncounterCount', 'count'].includes(key),
	);
}

function queryDirectMatches(
	resources: AuthoredSourceResource[],
	resourceType: string,
	filter: Record<string, unknown>,
): AuthoredSourceResource[] {
	return resources.filter((resource) => {
		if (resource.resourceType !== resourceType) {
			return false;
		}

		for (const [key, value] of Object.entries(filter)) {
			if (key === 'age') {
				if (!matchesRange(computeAge(resource.value.birthday), value)) {
					return false;
				}
				continue;
			}

			if (key === 'stayDays') {
				if (!matchesRange(computeStayDays(resource.value.periodStart, resource.value.periodEnd), value)) {
					return false;
				}
				continue;
			}

			if (resource.value[key] !== value) {
				return false;
			}
		}

		return true;
	});
}

function computeAge(birthday: unknown): number | null {
	if (typeof birthday !== 'string' || birthday.length === 0) {
		return null;
	}

	const birth = new Date(birthday);

	if (Number.isNaN(birth.getTime())) {
		return null;
	}

	const now = new Date();
	let age = now.getUTCFullYear() - birth.getUTCFullYear();
	const hasBirthdayPassed =
		now.getUTCMonth() > birth.getUTCMonth() ||
		(now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() >= birth.getUTCDate());

	if (!hasBirthdayPassed) {
		age -= 1;
	}

	return age;
}

function computeStayDays(periodStart: unknown, periodEnd: unknown): number | null {
	if (typeof periodStart !== 'string' || typeof periodEnd !== 'string') {
		return null;
	}

	const start = new Date(periodStart);
	const end = new Date(periodEnd);

	if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
		return null;
	}

	return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function matchesRange(value: number | null, constraint: unknown): boolean {
	if (value === null || !isRecord(constraint)) {
		return false;
	}

	for (const [key, boundary] of Object.entries(constraint)) {
		if (typeof boundary !== 'number') {
			return false;
		}

		switch (key) {
			case 'gt':
				if (!(value > boundary)) {
					return false;
				}
				break;
			case 'gte':
				if (!(value >= boundary)) {
					return false;
				}
				break;
			case 'lt':
				if (!(value < boundary)) {
					return false;
				}
				break;
			case 'lte':
				if (!(value <= boundary)) {
					return false;
				}
				break;
			default:
				return false;
		}
	}

	return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function error(code: string, path: string, message: string, help?: string): DatasetValidationIssue {
	return { severity: 'error', code, path, message, help };
}

function warning(code: string, path: string, message: string, help?: string): DatasetValidationIssue {
	return { severity: 'warning', code, path, message, help };
}

function errorIssue(code: string, path: string, message: string, help?: string): DatasetValidationIssue {
	return error(code, path, message, help);
}
