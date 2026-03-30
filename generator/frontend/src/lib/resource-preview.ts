import { getBundleEntrySourceKeys, getOrderedSourceKeys, readScenarioResourceMapping } from '../resource-mapping.js';
import { readSourceResourceType } from '@fhirfox/converter/browser';

import type {
	FhirBundleRecord,
	PreviewResourceItem,
	ScenarioResultRecord,
	SourceCodeDisplayMap,
	SourceResourceRecord,
} from '../types.js';

type PreviewResourceDescriptor<TResource> = {
	resource: TResource;
	resourceType: string;
	id: string;
	sourceKey: string;
	subtitle: string | undefined;
};

const BUNDLE_SOURCE_FIELD_ALIASES: Record<string, string> = {
	'Encounter.status': 'status',
	'Patient.gender': 'gender',
	'Procedure.status': 'status',
	'AllergyIntolerance.criticality': 'criticality',
};

export function getSourcePreviewResourceItems(
	scenarioResult: ScenarioResultRecord | null,
	sourceCodeDisplayMap: SourceCodeDisplayMap = {},
): PreviewResourceItem[] {
	if (!scenarioResult) {
		return [];
	}

	const orderedSourceKeys = getOrderedSourceKeys(scenarioResult);

	return buildPreviewItems(
		scenarioResult.orderedResources.map((resource, resourceIndex) => {
			const resourceType = readSourceResourceType(resource);
			const id = readString(resource.id) ?? `${resourceType}-${resourceIndex + 1}`;

			return {
				resource,
				resourceType,
				id,
				sourceKey: orderedSourceKeys[resourceIndex] ?? `${resourceType.toLowerCase()}/${id}`,
				subtitle: getSourceResourceSubtitle(resourceType, resource, sourceCodeDisplayMap),
			};
		}),
		'source',
	);
}

export function getBundlePreviewResourceItems(bundle: FhirBundleRecord | null): PreviewResourceItem[] {
	return getBundlePreviewResourceItemsWithDisplays(bundle, {});
}

export function getBundlePreviewResourceItemsWithDisplays(
	bundle: FhirBundleRecord | null,
	sourceCodeDisplayMap: SourceCodeDisplayMap = {},
): PreviewResourceItem[] {
	if (!bundle) {
		return [];
	}

	const sourceKeys = getBundleEntrySourceKeys(bundle);
	const orderedSourceKeys = readScenarioResourceMapping(bundle)?.orderedSourceKeys ?? sourceKeys;
	const sourceKeyRank = new Map(orderedSourceKeys.map((sourceKey, index) => [sourceKey, index]));

	return buildPreviewItems(
		bundle.entry
			.map((entry, index) => {
				const resource = entry.resource;
				const resourceType = readString(resource.resourceType) ?? 'Resource';
				const id = readString(resource.id) ?? `${resourceType}-${index + 1}`;
				const sourceKey = sourceKeys[index] ?? `${resourceType.toLowerCase()}/${id}`;

				return {
					resource,
					resourceType,
					id,
					sourceKey,
					subtitle: getBundleResourceSubtitle(resourceType, resource, sourceCodeDisplayMap),
				};
			})
			.sort(
				(left, right) =>
					(sourceKeyRank.get(left.sourceKey) ?? Number.MAX_SAFE_INTEGER) -
					(sourceKeyRank.get(right.sourceKey) ?? Number.MAX_SAFE_INTEGER),
			),
		'bundle',
	);
}

function getSourceResourceSubtitle(
	resourceType: string,
	resource: SourceResourceRecord,
	sourceCodeDisplayMap: SourceCodeDisplayMap,
): string | undefined {
	switch (resourceType.toLowerCase()) {
		case 'patient':
			return joinParts([
				readString(resource.name),
				readSourceDisplay(resourceType, 'gender', resource.gender, sourceCodeDisplayMap),
				readString(resource.birthday),
			]);
		case 'organization':
			return readString(resource.name) ?? readString(resource.alias);
		case 'practitioner':
			return readString(resource.name);
		case 'practitionerrole':
			return joinParts([
				readSourceDisplay(resourceType, 'roleCode', resource.roleCode, sourceCodeDisplayMap),
				readSourceDisplay(resourceType, 'specialtyCode', resource.specialtyCode, sourceCodeDisplayMap),
			]);
		case 'encounter':
			return joinParts([
				readSourceDisplay(resourceType, 'serviceType', resource.serviceType, sourceCodeDisplayMap),
				readSourceDisplay(resourceType, 'class', resource.class, sourceCodeDisplayMap),
				readSourceDisplay(resourceType, 'status', resource.status, sourceCodeDisplayMap),
			]);
		case 'condition':
			return joinParts([
				readString(resource.conditionText),
				readSourceDisplay(resourceType, 'conditionCode', resource.conditionCode, sourceCodeDisplayMap),
			]);
		case 'procedure':
			return joinParts([
				readString(resource.procedureText),
				readSourceDisplay(resourceType, 'procedureCode', resource.procedureCode, sourceCodeDisplayMap),
			]);
		case 'observation':
			return joinParts([
				readSourceDisplay(resourceType, 'observationCode', resource.observationCode, sourceCodeDisplayMap),
				readString(resource.valueQuantity),
			]);
		case 'allergyintolerance':
			return joinParts([
				readSourceDisplay(resourceType, 'allergyCode', resource.allergyCode, sourceCodeDisplayMap),
				readSourceDisplay(resourceType, 'criticality', resource.criticality, sourceCodeDisplayMap),
			]);
		default:
			return readString(resource.name) ?? readString(resource.type) ?? undefined;
	}
}

function getBundleResourceSubtitle(
	resourceType: string,
	resource: Record<string, unknown>,
	sourceCodeDisplayMap: SourceCodeDisplayMap,
): string | undefined {
	switch (resourceType) {
		case 'Patient':
			return joinParts([
				readHumanName(resource.name),
				readBundleDisplay(resourceType, 'gender', resource.gender, sourceCodeDisplayMap),
				readString(resource.birthDate),
			]);
		case 'Organization':
			return readString(resource.name) ?? readFirstString(resource.alias);
		case 'Practitioner':
			return readHumanName(resource.name);
		case 'PractitionerRole':
			return joinParts([readCodeableConceptText(resource.code), readCodeableConceptText(resource.specialty)]);
		case 'Encounter':
			return joinParts([
				readCodeableConceptText(resource.serviceType),
				readCodingText(resource.class),
				readBundleDisplay(resourceType, 'status', resource.status, sourceCodeDisplayMap),
			]);
		case 'Condition':
			return joinParts([readCodeableConceptText(resource.code), readCodeableConceptText(resource.severity)]);
		case 'Procedure':
			return joinParts([
				readCodeableConceptText(resource.code),
				readBundleDisplay(resourceType, 'status', resource.status, sourceCodeDisplayMap),
			]);
		case 'Observation':
			return joinParts([readCodeableConceptText(resource.code), readObservationValue(resource.valueQuantity)]);
		case 'AllergyIntolerance':
			return joinParts([
				readCodeableConceptText(resource.code),
				readBundleDisplay(resourceType, 'criticality', resource.criticality, sourceCodeDisplayMap),
			]);
		default:
			return (
				readString(resource.title) ?? readString(resource.name) ?? readCodeableConceptText(resource.code) ?? undefined
			);
	}
}

function readSourceDisplay(
	resourceType: string,
	fieldName: string,
	value: unknown,
	sourceCodeDisplayMap: SourceCodeDisplayMap,
): string | undefined {
	return readMappedDisplay(resourceType, fieldName, value, sourceCodeDisplayMap);
}

function readBundleDisplay(
	resourceType: string,
	fieldName: string,
	value: unknown,
	sourceCodeDisplayMap: SourceCodeDisplayMap,
): string | undefined {
	return readMappedDisplay(
		resourceType,
		getBundleSourceFieldName(resourceType, fieldName),
		value,
		sourceCodeDisplayMap,
	);
}

function getBundleSourceFieldName(resourceType: string, fieldName: string): string {
	return BUNDLE_SOURCE_FIELD_ALIASES[`${resourceType}.${fieldName}`] ?? fieldName;
}

function readMappedDisplay(
	resourceType: string,
	fieldName: string,
	value: unknown,
	sourceCodeDisplayMap: SourceCodeDisplayMap,
): string | undefined {
	const rawValue = readString(value);

	if (!rawValue) {
		return undefined;
	}

	return sourceCodeDisplayMap[`${resourceType.toLowerCase()}.${fieldName}:${rawValue}`] ?? rawValue;
}

function buildPreviewItems<TResource>(
	descriptors: PreviewResourceDescriptor<TResource>[],
	scope: 'source' | 'bundle',
): PreviewResourceItem[] {
	return descriptors.map((descriptor, index) => ({
		id: `${scope}-${descriptor.resourceType}-${descriptor.id}-${index}`,
		resourceType: descriptor.resourceType,
		sourceKey: descriptor.sourceKey,
		title: descriptor.id,
		subtitle: descriptor.subtitle,
		resource: descriptor.resource as PreviewResourceItem['resource'],
	}));
}

function readString(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readFirstString(value: unknown): string | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}

	return value.find((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function readHumanName(value: unknown): string | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}

	for (const entry of value) {
		if (!isRecord(entry)) {
			continue;
		}

		if ('text' in entry && typeof entry.text === 'string' && entry.text.length > 0) {
			return entry.text;
		}

		const given = Array.isArray(entry.given)
			? entry.given.filter((part: unknown): part is string => typeof part === 'string')
			: [];
		const family = typeof entry.family === 'string' ? entry.family : undefined;
		const combined = joinParts([family, given.join(' ')]);

		if (combined) {
			return combined;
		}
	}

	return undefined;
}

function readCodeableConceptText(value: unknown): string | undefined {
	if (!isRecord(value)) {
		return undefined;
	}

	if ('text' in value && typeof value.text === 'string' && value.text.length > 0) {
		return value.text;
	}

	const coding = 'coding' in value ? value.coding : undefined;

	if (!Array.isArray(coding)) {
		return undefined;
	}

	for (const codingEntry of coding) {
		if (!isRecord(codingEntry)) {
			continue;
		}

		if ('display' in codingEntry && typeof codingEntry.display === 'string' && codingEntry.display.length > 0) {
			return codingEntry.display;
		}

		if ('code' in codingEntry && typeof codingEntry.code === 'string' && codingEntry.code.length > 0) {
			return codingEntry.code;
		}
	}

	return undefined;
}

function readCodingText(value: unknown): string | undefined {
	if (!isRecord(value)) {
		return undefined;
	}

	if ('display' in value && typeof value.display === 'string' && value.display.length > 0) {
		return value.display;
	}

	if ('code' in value && typeof value.code === 'string' && value.code.length > 0) {
		return value.code;
	}

	return readCodeableConceptText(value);
}

function readObservationValue(value: unknown): string | undefined {
	if (!isRecord(value)) {
		return undefined;
	}

	const numericValue =
		'value' in value && (typeof value.value === 'number' || typeof value.value === 'string')
			? String(value.value)
			: undefined;
	const unit = 'unit' in value && typeof value.unit === 'string' ? value.unit : undefined;

	return joinParts([numericValue, unit ? `/ ${unit}` : undefined]);
}

function joinParts(parts: Array<string | undefined>): string | undefined {
	const filtered = parts.filter((part): part is string => typeof part === 'string' && part.length > 0);
	const deduped = filtered.filter((part, index) => filtered.findIndex((entry) => entry === part) === index);
	return deduped.length > 0 ? deduped.join(' · ') : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
