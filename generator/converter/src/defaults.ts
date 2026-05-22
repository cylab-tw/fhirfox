import type { FhirResource, SourceResource } from './types.js';

export function applyResourceDefaults(resource: FhirResource, input: SourceResource, sourceResourceType: string): void {
	applySourceIdentifierDefault(resource, input, sourceResourceType);
	applyIdentifierSystemDefaults(resource, input, sourceResourceType);
	applyObservationDefaults(resource, input, sourceResourceType);
	applyNarrativeDefault(resource);
}

function applySourceIdentifierDefault(
	resource: FhirResource,
	input: SourceResource,
	sourceResourceType: string,
): void {
	if (typeof input.id !== 'string' || input.id.length === 0) {
		return;
	}

	const identifiers = Array.isArray(resource.identifier)
		? (resource.identifier as Array<Record<string, unknown>>)
		: [];
	const existingIndex = identifiers.findIndex((identifier) => identifier.value === input.id);
	const sourceIdentifier =
		existingIndex >= 0 ? { ...identifiers[existingIndex] } : ({ value: input.id } as Record<string, unknown>);

	sourceIdentifier.system = readIdentifierSystem(input) ?? `https://fhirfox.dev/identifier-system/${sourceResourceType}`;

	if (existingIndex >= 0) {
		identifiers.splice(existingIndex, 1);
	}

	resource.identifier = allowsAdditionalIdentifiers(sourceResourceType)
		? [sourceIdentifier, ...identifiers]
		: [sourceIdentifier];
}

function allowsAdditionalIdentifiers(sourceResourceType: string): boolean {
	return sourceResourceType === 'patient' || sourceResourceType === 'practitioner';
}

function applyIdentifierSystemDefaults(
	resource: FhirResource,
	input: SourceResource,
	sourceResourceType: string,
): void {
	const identifiers = Array.isArray(resource.identifier)
		? (resource.identifier as Array<Record<string, unknown>>)
		: undefined;

	if (!identifiers) {
		return;
	}

	for (const identifier of identifiers) {
		if (typeof identifier.system === 'string' && identifier.system.length > 0) {
			continue;
		}

		const typeCode = identifier.type as { coding?: Array<{ code?: string }> } | undefined;
		const code = typeCode?.coding?.[0]?.code;
		identifier.system = resolveIdentifierSystem(sourceResourceType, typeof code === 'string' ? code : undefined, input);
	}
}

function resolveIdentifierSystem(
	sourceResourceType: string,
	identifierTypeCode: string | undefined,
	input: SourceResource,
): string {
	if ((sourceResourceType === 'patient' || sourceResourceType === 'practitioner') && identifierTypeCode === 'NNxxx') {
		return 'http://www.moi.gov.tw';
	}

	if (sourceResourceType === 'practitioner' && identifierTypeCode === 'MR') {
		return 'https://www.tph.mohw.gov.tw';
	}

	if (sourceResourceType === 'encounter') {
		return 'https://fhirfox.dev/identifier-system/encounter';
	}

	const fallbackType = identifierTypeCode ?? (typeof input.identityType === 'string' ? input.identityType : 'default');
	return `https://fhirfox.dev/identifier-system/${sourceResourceType}/${fallbackType}`;
}

function readIdentifierSystem(input: SourceResource): string | undefined {
	return typeof input.idSystem === 'string' && input.idSystem.length > 0
		? input.idSystem
		: undefined;
}

function applyObservationDefaults(resource: FhirResource, input: SourceResource, sourceResourceType: string): void {
	if (sourceResourceType !== 'observation' || input.observationCode !== 'VS-0008') {
		return;
	}

	delete resource.valueQuantity;

	const components = Array.isArray(resource.component) ? (resource.component as Array<Record<string, unknown>>) : [];
	resource.component = components;

	applyBloodPressureComponentDefaults(components, 0, '8480-6');
	applyBloodPressureComponentDefaults(components, 1, '8462-4');
}

function applyBloodPressureComponentDefaults(
	components: Array<Record<string, unknown>>,
	index: number,
	code: string,
): void {
	components[index] ??= {};
	const component = components[index];
	component.code ??= {};

	const codeableConcept = component.code as Record<string, unknown>;
	const coding = Array.isArray(codeableConcept.coding)
		? (codeableConcept.coding as Array<Record<string, unknown>>)
		: [];
	codeableConcept.coding = coding;
	coding[0] = {
		...coding[0],
		system: 'http://loinc.org',
		code,
	};

	if (
		typeof component.valueQuantity !== 'object' ||
		component.valueQuantity === null ||
		Array.isArray(component.valueQuantity)
	) {
		return;
	}

	const valueQuantity = component.valueQuantity as Record<string, unknown>;
	valueQuantity.unit ??= 'mmHg';
	valueQuantity.system ??= 'http://unitsofmeasure.org';
	valueQuantity.code ??= 'mm[Hg]';
}

function applyNarrativeDefault(resource: FhirResource): void {
	if (typeof resource.text === 'object' && resource.text !== null) {
		return;
	}

	const label = resource.resourceType;
	resource.text = {
		status: 'generated',
		div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${escapeHtml(label)}</p></div>`,
	};
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}
