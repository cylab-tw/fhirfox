const sourceResourceTypeDisplayNames: Record<string, string> = {
	allergyintolerance: 'AllergyIntolerance',
	condition: 'Condition',
	diagnosticreport: 'DiagnosticReport',
	encounter: 'Encounter',
	imagingstudy: 'ImagingStudy',
	medication: 'Medication',
	medicationrequest: 'MedicationRequest',
	observation: 'Observation',
	'observation-laboratory-result': 'Observation',
	'observation-vital-signs': 'Observation',
	organization: 'Organization',
	patient: 'Patient',
	practitioner: 'Practitioner',
	practitionerrole: 'PractitionerRole',
	procedure: 'Procedure',
};

const sourceResourceTypePluralNames: Record<string, string> = {
	allergyintolerance: 'allergyintolerances',
	condition: 'conditions',
	diagnosticreport: 'diagnosticreports',
	encounter: 'encounters',
	imagingstudy: 'imagingstudies',
	medication: 'medications',
	medicationrequest: 'medicationrequests',
	observation: 'observations',
	'observation-laboratory-result': 'observationLaboratoryResults',
	'observation-vital-signs': 'observationVitalSigns',
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
	const normalizedType = normalizeSourceResourceTypeForUi(resourceType);
	return sourceResourceTypeDisplayNames[normalizedType] ?? capitalizeWord(resourceType);
}

export function normalizeSourceResourceTypeForUi(resourceType: string): string {
	const normalizedType = resourceType.toLowerCase();

	if (normalizedType === 'observation-laboratory-result' || normalizedType === 'observation-vital-signs') {
		return 'observation';
	}

	return normalizedType;
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
