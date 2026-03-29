import { applyResourceDefaults } from '../defaults.js';
import { readNormalizedSourceResourceType } from '../source-resource.js';
import { resolveCodeMapping } from '../terminology/lookup.js';
import { writeFhirValue } from '../fhir-path/write.js';

import type { ConvertOptions, ConverterRuleSet, FhirResource, GeneratorRuleRow, SourceResource } from '../types.js';

/**
 * Converts one source resource into one FHIR resource using indexed rules.
 */
export function convertResource(
	input: SourceResource,
	ruleSet: ConverterRuleSet,
	options: ConvertOptions,
): FhirResource {
	const sourceResourceType = readNormalizedSourceResourceType(input);
	const rules = ruleSet.generatorRulesByResourceType.get(sourceResourceType);

	if (!rules || rules.length === 0) {
		throw new Error(`No converter rules found for ${sourceResourceType} (${options.igName}@${options.igVersion}).`);
	}

	const resourceType = getFhirResourceType(rules[0]?.fhirPath);
	const resource: FhirResource = {
		resourceType,
	};

	for (const rule of rules) {
		applyRule(resource, input, rule, ruleSet);
	}

	resource.id ??= input.id;

	const profile = ruleSet.resourceProfilesByResourceType.get(sourceResourceType);

	if (profile) {
		resource.meta = {
			...resource.meta,
			profile: [profile.profileUrl],
		};
	}

	applyResourceDefaults(resource, input, sourceResourceType);

	return resource;
}

function applyRule(
	resource: FhirResource,
	input: SourceResource,
	rule: GeneratorRuleRow,
	ruleSet: ConverterRuleSet,
): void {
	const rawValue = input[rule.sourceColumn];

	if (isMissing(rawValue)) {
		if (rule.isRequired) {
			throw new Error(`Missing required source value "${rule.sourceColumn}" for resource "${rule.resourceType}".`);
		}

		return;
	}

	switch (rule.transformKind) {
		case 'copy':
			writeFhirValue(resource, rule.fhirPath, rawValue, rule.dataType);
			return;
		case 'build_reference':
			writeFhirValue(
				resource,
				rule.fhirPath,
				buildReference(input, rule.sourceColumn, rawValue, rule.referenceTarget),
				'string',
			);
			return;
		case 'code_map': {
			if (!rule.mappingKey) {
				throw new Error(`Missing mapping key for rule "${rule.fhirPath}".`);
			}

			const mapping = resolveCodeMapping(ruleSet, rule.mappingKey, String(rawValue));
			writeFhirValue(resource, rule.fhirPath, mapping.code, rule.dataType, mapping);
			return;
		}
		default:
			throw new Error(`Unsupported transform kind "${String(rule.transformKind)}".`);
	}
}

function getFhirResourceType(fhirPath: string | undefined): string {
	if (!fhirPath) {
		throw new Error('Cannot determine FHIR resource type without a rule path.');
	}

	const [resourceType] = fhirPath.split('.', 1);

	if (!resourceType) {
		throw new Error(`Invalid FHIR path "${fhirPath}".`);
	}

	return resourceType;
}

function isMissing(value: unknown): boolean {
	return value === undefined || value === null || value === '';
}

function buildReference(
	input: SourceResource,
	sourceColumn: string,
	value: unknown,
	referenceTarget: string | undefined,
): string | string[] {
	const resolvedReferenceTarget = readExplicitReferenceTarget(input, sourceColumn) ?? referenceTarget;

	if (!resolvedReferenceTarget) {
		throw new Error('Reference rule is missing a reference target.');
	}

	if (Array.isArray(value)) {
		return value
			.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
			.map((entry) => `${resolvedReferenceTarget}/${entry}`);
	}

	return `${resolvedReferenceTarget}/${String(value)}`;
}

function readExplicitReferenceTarget(input: SourceResource, sourceColumn: string): string | undefined {
	const typeField = getReferenceTypeFieldName(sourceColumn);
	const explicitType = input[typeField];

	if (typeof explicitType !== 'string' || explicitType.length === 0) {
		return undefined;
	}

	return toFhirReferenceTarget(explicitType);
}

function getReferenceTypeFieldName(sourceColumn: string): string {
	return sourceColumn.endsWith('Id') ? `${sourceColumn.slice(0, -2)}Type` : `${sourceColumn}Type`;
}

function toFhirReferenceTarget(resourceType: string): string {
	switch (resourceType.toLowerCase()) {
		case 'allergyintolerance':
			return 'AllergyIntolerance';
		case 'careteam':
			return 'CareTeam';
		case 'condition':
			return 'Condition';
		case 'device':
			return 'Device';
		case 'encounter':
			return 'Encounter';
		case 'location':
			return 'Location';
		case 'observation':
			return 'Observation';
		case 'organization':
			return 'Organization';
		case 'patient':
			return 'Patient';
		case 'practitioner':
			return 'Practitioner';
		case 'practitionerrole':
			return 'PractitionerRole';
		case 'procedure':
			return 'Procedure';
		case 'relatedperson':
			return 'RelatedPerson';
		default:
			return resourceType.charAt(0).toUpperCase() + resourceType.slice(1);
	}
}
