const sourceResourceTypeDisplayNames: Record<string, string> = {
	allergyintolerance: 'AllergyIntolerance',
	condition: 'Condition',
	encounter: 'Encounter',
	observation: 'Observation',
	organization: 'Organization',
	patient: 'Patient',
	practitioner: 'Practitioner',
	practitionerrole: 'PractitionerRole',
	procedure: 'Procedure',
};

const sourceResourceTypePluralNames: Record<string, string> = {
	allergyintolerance: 'allergyintolerances',
	condition: 'conditions',
	encounter: 'encounters',
	observation: 'observations',
	organization: 'organizations',
	patient: 'patients',
	practitioner: 'practitioners',
	practitionerrole: 'practitionerroles',
	procedure: 'procedures',
};

const pluralToSingularResourceType = Object.fromEntries(
	Object.entries(sourceResourceTypePluralNames).map(([singular, plural]) => [plural, singular]),
);

export function formatSourceResourceType(resourceType: string): string {
	const normalizedType = resourceType.toLowerCase();
	return sourceResourceTypeDisplayNames[normalizedType] ?? capitalizeWord(resourceType);
}

export function pluralizeSourceResourceType(resourceType: string): string {
	const normalizedType = resourceType.toLowerCase();
	return sourceResourceTypePluralNames[normalizedType] ?? `${normalizedType}s`;
}

export function singularizeSourceResourceType(resourceType: string): string {
	const normalizedType = resourceType.toLowerCase();
	return pluralToSingularResourceType[normalizedType] ?? resourceType;
}

export function formatSourceDocumentResources(resources: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(resources).map(([resourceType, value]) => [pluralizeSourceResourceType(resourceType), value]),
	);
}

function capitalizeWord(value: string): string {
	return value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}
