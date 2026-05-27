import { applyResourceDefaults } from '../defaults.js';
import { readNormalizedSourceResourceType } from '../source-resource.js';
import { resolveCodeMappings } from '../terminology/lookup.js';
import { writeFhirValue } from '../fhir-path/write.js';

import type {
	ConvertOptions,
	ConverterRuleSet,
	FhirCodingMapping,
	FhirResource,
	GeneratorRuleRow,
	SourceResource,
} from '../types.js';

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

	attachSourceId(resource, input.id);

	const profileUrl = resolveResourceProfileUrl(sourceResourceType, resource, ruleSet);

	if (profileUrl) {
		resource.meta = {
			...resource.meta,
			profile: [profileUrl],
		};
	}

	applyResourceDefaults(resource);
	delete resource.id;

	return resource;
}

function resolveResourceProfileUrl(
	sourceResourceType: string,
	resource: FhirResource,
	ruleSet: ConverterRuleSet,
): string | undefined {
	const profiles = ruleSet.resourceProfilesByResourceType.get(sourceResourceType) ?? [];
	const matchedProfile = profiles.find((profile) => profileMatchesResource(profile, resource));

	return matchedProfile?.profileUrl ?? profiles.find((profile) => !profile.matchFhirPath)?.profileUrl;
}

function profileMatchesResource(
	profile: { matchFhirPath?: string; matchValue?: string },
	resource: FhirResource,
): boolean {
	if (!profile.matchFhirPath || profile.matchValue === undefined) {
		return false;
	}

	return readFhirPathValue(resource, profile.matchFhirPath) === profile.matchValue;
}

function readFhirPathValue(resource: FhirResource, fhirPath: string): unknown {
	const segments = fhirPath.split('.');
	const [resourceType, ...pathSegments] = segments;

	if (resourceType !== resource.resourceType) {
		return undefined;
	}

	return pathSegments.reduce<unknown>((current, segment) => {
		if (current === undefined || current === null) {
			return undefined;
		}

		const parsedSegment = /^(?<name>[A-Za-z][A-Za-z0-9]*)(?:\[(?<index>\d+)\])?$/u.exec(segment)?.groups;
		if (!parsedSegment || typeof current !== 'object') {
			return undefined;
		}

		const value = (current as Record<string, unknown>)[parsedSegment.name];
		if (parsedSegment.index === undefined) {
			return value;
		}

		if (!Array.isArray(value)) {
			return undefined;
		}

		return value[Number.parseInt(parsedSegment.index, 10)];
	}, resource);
}

function attachSourceId(resource: FhirResource, sourceId: string): void {
	Object.defineProperty(resource, '__sourceId', {
		value: sourceId,
		enumerable: false,
		configurable: true,
		writable: true,
	});
}

function applyRule(
	resource: FhirResource,
	input: SourceResource,
	rule: GeneratorRuleRow,
	ruleSet: ConverterRuleSet,
): void {
	const sourceField = getSourceFieldName(rule);
	const rawValue = readSourceValue(input, sourceField);

	if (rule.transformKind === 'constant') {
		if (!rule.mappingKey) {
			throw new Error(`Constant rule "${rule.fhirPath}" is missing a value.`);
		}
		if (isMissing(rawValue)) {
			if (rule.isRequired) {
				throw new Error(`Missing required source value "${rule.path}" for resource "${rule.resourceType}".`);
			}

			return;
		}
		writeFhirValue(resource, rule.fhirPath, rule.mappingKey, rule.dataType);
		return;
	}

	if (
		rule.resourceType === 'encounter' &&
		sourceField === 'diagnosisUse' &&
		isMissing(readSourceValue(input, 'conditionId'))
	) {
		return;
	}

	if (isMissing(rawValue)) {
		if (rule.isRequired) {
			throw new Error(`Missing required source value "${rule.path}" for resource "${rule.resourceType}".`);
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
				buildReference(input, sourceField, rawValue, rule.referenceTarget),
				'string',
			);
			return;
		case 'code_map': {
			const mappingKey = resolveMappingKey(rule, input);
			if (!mappingKey) {
				throw new Error(`Missing mapping key for rule "${rule.fhirPath}".`);
			}

			const mappings = resolveCodeMappings(ruleSet, mappingKey, String(rawValue));
			writeCodeMappedValues(resource, rule, mappings);
			return;
		}
		default:
			throw new Error(`Unsupported transform kind "${String(rule.transformKind)}".`);
	}
}

function writeCodeMappedValues(resource: FhirResource, rule: GeneratorRuleRow, mappings: FhirCodingMapping[]): void {
	for (const [index, mapping] of mappings.entries()) {
		writeFhirValue(resource, getIndexedCodingPath(rule.fhirPath, index), mapping.code, rule.dataType, mapping);
	}
}

function getIndexedCodingPath(fhirPath: string, index: number): string {
	const indexedPath = fhirPath.replace(/\.coding\[\d+\]\.code$/u, `.coding[${index}].code`);

	if (index > 0 && indexedPath === fhirPath) {
		throw new Error(`Multiple code mappings require a coding array path, got "${fhirPath}".`);
	}

	return indexedPath;
}

function readSourceValue(input: SourceResource, sourceField: string): unknown {
	if (input[sourceField] !== undefined) {
		return input[sourceField];
	}

	const legacyField = legacySourceFieldAliases[sourceField];
	return legacyField ? input[legacyField] : undefined;
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

function resolveMappingKey(rule: GeneratorRuleRow, input: SourceResource): string | undefined {
	void input;
	return rule.mappingKey;
}

function getSourceFieldName(rule: GeneratorRuleRow): string {
	const [, fieldName] = rule.path.split('.', 2);

	if (!fieldName) {
		throw new Error(`Invalid resource definition path "${rule.path}".`);
	}

	return fieldName;
}

const legacySourceFieldAliases: Record<string, string> = {
	idNumber: 'identityNumber',
	birthDate: 'birthday',
	subjectId: 'patientId',
	onsetDateTime: 'onsetDate',
	effectiveDateTime: 'effectiveDate',
	code: 'allergyCode',
	reactionManifestation: 'manifestation',
	reactionSeverity: 'severity',
	reactionExposureRoute: 'exposureRoute',
	reactionNote: 'note',
};

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
		case 'diagnosticreport':
			return 'DiagnosticReport';
		case 'encounter':
			return 'Encounter';
		case 'imagingstudy':
			return 'ImagingStudy';
		case 'location':
			return 'Location';
		case 'medication':
			return 'Medication';
		case 'medicationrequest':
			return 'MedicationRequest';
		case 'observation':
		case 'observation-laboratory-result':
		case 'observation-vital-signs':
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
