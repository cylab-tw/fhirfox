import type { FhirResource, SourceResource } from './types.js';

export function applyResourceDefaults(resource: FhirResource, input: SourceResource, sourceResourceType: string): void {
	applyIdentifierSystemDefaults(resource, input, sourceResourceType);
	applyNarrativeDefault(resource);
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
	if (sourceResourceType === 'patient' && identifierTypeCode === 'NNxxx') {
		return 'http://www.moi.gov.tw';
	}

	if ((sourceResourceType === 'practitioner' || sourceResourceType === 'organization') && identifierTypeCode === 'MR') {
		return 'https://www.tph.mohw.gov.tw';
	}

	if (sourceResourceType === 'encounter') {
		return 'https://fhirfox.dev/identifier-system/encounter';
	}

	const fallbackType = identifierTypeCode ?? (typeof input.idType === 'string' ? input.idType : 'default');
	return `https://fhirfox.dev/identifier-system/${sourceResourceType}/${fallbackType}`;
}

function applyNarrativeDefault(resource: FhirResource): void {
	if (typeof resource.text === 'object' && resource.text !== null) {
		return;
	}

	const label = [resource.resourceType, resource.id]
		.filter((value): value is string => typeof value === 'string' && value.length > 0)
		.join('/');
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
