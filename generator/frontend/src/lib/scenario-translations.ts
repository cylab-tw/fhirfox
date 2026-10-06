import type { Locale } from '../i18n.js';
import type { ScenarioRecord } from '../types.js';

const englishScenarioContent: Record<string, Pick<ScenarioRecord, 'displayName' | 'summary' | 'details'>> = {
	'IPS_TWCORE-MIX-001': {
		displayName: 'Patient 4: Multiple Outpatient and Emergency Visits',
		summary:
			'Patient 4 completes four cardiology outpatient visits and one emergency visit for fever. Each outpatient visit includes three medication orders, with two cardiology laboratory tests in total.',
		details: `This scenario verifies that outpatient and emergency Encounters for the same patient can be expanded together while preserving cardiology medications and laboratory results.

- 4 cardiology outpatient visits
- 1 emergency visit for fever
- 3 MedicationRequests per outpatient visit
- 2 cardiology laboratory tests`,
	},
	'IPS_TWCORE-MIX-002': {
		displayName: 'Patient 3: Multiple Cross-Specialty Outpatient and Emergency Visits',
		summary:
			'Patient 3 completes cross-specialty outpatient visits and an emergency visit for a head injury, including three medication orders per outpatient visit, two laboratory tests, and an emergency procedure.',
		details: `This scenario verifies that multi-specialty outpatient visits, an emergency head injury visit, and its procedure can be represented together in one scenario.

- 2 family medicine, 3 endocrinology, and 2 cardiology outpatient visits
- 1 emergency visit for a head injury
- 3 MedicationRequests per outpatient visit
- 1 endocrinology and 1 cardiology laboratory test`,
	},
	'IPS_TWCORE-MIX-003': {
		displayName: 'Patient 5: Multiple Outpatient Visits and Inpatient Surgery',
		summary:
			'Patient 5 completes four cardiology outpatient visits and an inpatient coronary stent procedure. Each outpatient visit includes three medication orders, with three laboratory tests in total.',
		details: `This scenario verifies that cardiology outpatient visits, an inpatient Encounter, and a coronary stent Procedure for the same patient can be represented together.

- 4 cardiology outpatient visits
- 1 coronary stent procedure
- 1 related inpatient stay
- 3 MedicationRequests per outpatient visit
- 3 cardiology laboratory tests`,
	},
	'IPS_TWCORE-OPD-010': {
		displayName: 'Patient 1: Multiple Single-Specialty Outpatient Visits',
		summary:
			'Patient 1 completes five endocrinology follow-up visits. Each visit includes three chronic medication orders, with three sets of laboratory results and reports in total.',
		details: `This scenario verifies multiple outpatient visits within one specialty, multiple chronic medications, and associated laboratory reports for a single patient.

- Multiple endocrinology outpatient visits for Patient 1
- 5 outpatient Encounters
- 3 MedicationRequests per outpatient visit
- 3 laboratory Observations with corresponding DiagnosticReports`,
	},
	'IPS_TWCORE-OPD-011': {
		displayName: 'Patient 2: Multiple Cross-Specialty Outpatient Visits',
		summary:
			'Patient 2 completes seven cross-specialty outpatient visits covering family medicine, endocrinology, and cardiology, with three medication orders per visit and five laboratory tests in total.',
		details: `This scenario verifies the linkage of Encounters, medications, laboratory results, and reports across multiple outpatient specialties for the same patient.

- 2 family medicine, 3 endocrinology, and 2 cardiology outpatient visits
- 3 MedicationRequests per outpatient visit
- 3 endocrinology and 2 cardiology laboratory tests`,
	},
};

const englishScenarioTypes: Record<string, string> = {
	outpatient: 'Outpatient',
	emergency: 'Emergency',
	inpatient: 'Inpatient',
	mixed: 'Mixed',
};

export function localizeScenario(scenario: ScenarioRecord, locale: Locale): ScenarioRecord {
	if (locale !== 'en') {
		return scenario;
	}

	const translatedContent = englishScenarioContent[scenario.id];
	return {
		...scenario,
		...(translatedContent ?? {}),
		type: englishScenarioTypes[scenario.type.toLowerCase()] ?? scenario.type,
	};
}
