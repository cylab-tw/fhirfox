import ScenarioBrowserApp from './ScenarioBrowserApp.js';

const plugathonScenarioIds = [
	'IPS_TWCORE-MIX-001',
	'IPS_TWCORE-MIX-002',
	'IPS_TWCORE-MIX-003',
	'IPS_TWCORE-OPD-010',
	'IPS_TWCORE-OPD-011',
] as const;

const excludedPlugathonResourceTypes = ['encounter', 'practitionerrole'] as const;
const excludedPlugathonReferenceFields = {
	'*': ['encounterId'],
	medicationrequest: ['requesterId'],
	condition: ['recorderId'],
	procedure: ['performerId'],
} as const;

export default function PlugathonApp() {
	return (
		<ScenarioBrowserApp
			showFhirOutput={false}
			allowedScenarioIds={plugathonScenarioIds}
			groupScenariosByLevel={false}
			excludedSourceResourceTypes={excludedPlugathonResourceTypes}
			excludedSourceReferenceFields={excludedPlugathonReferenceFields}
		/>
	);
}
