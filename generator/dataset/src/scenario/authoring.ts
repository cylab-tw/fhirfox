import type { DatasetValidationIssue } from '../authoring/index.js';
import type { ScenarioSelection } from './scenario.js';

export const SCENARIO_RESOURCE_KEYS = [
	'patient',
	'encounter',
	'condition',
	'allergyIntolerance',
	'observation',
	'procedure',
	'medication',
	'medicationRequest',
	'diagnosticReport',
	'imagingStudy',
] as const;

export const SCENARIO_CANONICAL_METADATA_KEYS = [
	'id',
	'name',
	'type',
	'summary',
	'details',
	'level',
	'selection',
] as const;
export const SCENARIO_SELECTION_KEYS = [
	'strategy',
	'maxSeeds',
	'maxPatients',
	'maxLinkedEncounters',
	'expandLinks',
] as const;
export const SCENARIO_RANGE_KEYS = ['gt', 'gte', 'lt', 'lte'] as const;

export const SCENARIO_RESOURCE_FILTER_DEFINITIONS: Record<string, { keys: string[] }> = {
	patient: {
		keys: [
			'id',
			'idType',
			'idNumber',
			'active',
			'name',
			'telecomSystem',
			'telecomValue',
			'telecomUse',
			'gender',
			'birthday',
			'address',
			'organization',
			'age',
			'ageGroup',
			'samePerson',
		],
	},
	encounter: {
		keys: [
			'id',
			'identifier',
			'status',
			'class',
			'type',
			'serviceType',
			'patientId',
			'participantType',
			'practitionerId',
			'periodStart',
			'periodEnd',
			'conditionId',
			'diagnosisUse',
			'admitSource',
			'dischargeDisposition',
			'locationId',
			'serviceProviderId',
			'stayDays',
			'count',
		],
	},
	condition: {
		keys: [
			'clinicalStatus',
			'verificationStatus',
			'category',
			'severity',
			'conditionCode',
			'conditionText',
			'patientId',
			'encounterId',
			'onsetDate',
			'abatementDate',
			'recordedDate',
			'recorderId',
			'note',
		],
	},
	allergyIntolerance: {
		keys: [
			'clinicalStatus',
			'verificationStatus',
			'type',
			'category',
			'criticality',
			'allergyCode',
			'patientId',
			'encounterId',
			'onsetDate',
			'recordedDate',
			'recorderId',
			'note',
			'reactionSubstance',
			'manifestation',
			'severity',
			'exposureRoute',
		],
	},
	observation: {
		keys: [
			'status',
			'categoryCode',
			'observationCode',
			'patientId',
			'encounterId',
			'effectiveDate',
			'performerId',
			'valueQuantity',
			'valueUnit',
			'dataAbsentReason',
			'rangeLow',
			'rangeHigh',
			'systolicValue',
			'diastolicValue',
		],
	},
	procedure: {
		keys: [
			'id',
			'status',
			'statusReason',
			'category',
			'procedureCode',
			'procedureText',
			'patientId',
			'encounterId',
			'performedDate',
			'performerId',
			'performerFunction',
			'locationId',
			'reasonCode',
			'bodySite',
			'outcome',
			'complication',
		],
	},
	medication: {
		keys: ['id', 'code', 'display'],
	},
	medicationRequest: {
		keys: [
			'id',
			'status',
			'intent',
			'medicationId',
			'patientId',
			'encounterId',
			'authoredOn',
			'requesterId',
			'requesterType',
			'reasonReferenceId',
			'dosageText',
			'doseValue',
			'doseUnit',
			'frequency',
			'period',
			'periodUnit',
			'durationValue',
			'durationUnit',
		],
	},
	diagnosticReport: {
		keys: [
			'id',
			'status',
			'categoryCode',
			'reportCode',
			'patientId',
			'encounterId',
			'effectiveDate',
			'issued',
			'performerId',
			'performerType',
			'resultId',
			'imagingStudyId',
			'conclusion',
		],
	},
	imagingStudy: {
		keys: [
			'id',
			'status',
			'modalityCode',
			'patientId',
			'encounterId',
			'started',
			'numberOfSeries',
			'numberOfInstances',
			'studyDescription',
		],
	},
};

export function validateScenarioDocument(document: Record<string, unknown>): DatasetValidationIssue[] {
	const issues: DatasetValidationIssue[] = [];
	const allowedTopLevelKeys = new Set<string>([...SCENARIO_CANONICAL_METADATA_KEYS, ...SCENARIO_RESOURCE_KEYS]);

	for (const key of Object.keys(document)) {
		if (!allowedTopLevelKeys.has(key)) {
			issues.push({
				severity: 'error',
				code: 'scenario.unknownKey',
				path: key,
				message: `Unknown scenario key "${key}".`,
				help: 'Use documented scenario metadata keys and supported resource filter sections.',
			});
		}
	}

	if ('level' in document && (!Number.isInteger(document.level) || typeof document.level !== 'number')) {
		issues.push({
			severity: 'error',
			code: 'scenario.invalidLevel',
			path: 'level',
			message: 'Scenario field "level" must be an integer.',
		});
	}

	if ('selection' in document) {
		issues.push(...validateSelection(document.selection));
	}

	for (const resourceType of SCENARIO_RESOURCE_KEYS) {
		const selection = document[resourceType];

		if (selection === undefined) {
			continue;
		}

		issues.push(...validateScenarioSelection(resourceType, selection));
	}

	return issues;
}

export function validateSelection(selection: unknown): DatasetValidationIssue[] {
	const issues: DatasetValidationIssue[] = [];

	if (!isRecord(selection)) {
		return [
			{
				severity: 'error',
				code: 'scenario.selection.invalid',
				path: 'selection',
				message: 'Scenario field "selection" must be an object.',
			},
		];
	}

	for (const key of Object.keys(selection)) {
		if (!SCENARIO_SELECTION_KEYS.includes(key as (typeof SCENARIO_SELECTION_KEYS)[number])) {
			issues.push({
				severity: 'error',
				code: 'scenario.selection.unknownKey',
				path: `selection.${key}`,
				message: `Unknown selection key "${key}".`,
			});
		}
	}

	if (
		selection.strategy !== undefined &&
		selection.strategy !== 'best-match' &&
		selection.strategy !== 'grouped-by-patient'
	) {
		issues.push({
			severity: 'error',
			code: 'scenario.selection.invalidStrategy',
			path: 'selection.strategy',
			message: 'Selection strategy must be "best-match" or "grouped-by-patient".',
		});
	}

	for (const key of ['maxSeeds', 'maxPatients', 'maxLinkedEncounters'] as const) {
		if (selection[key] !== undefined && !isPositiveInteger(selection[key])) {
			issues.push({
				severity: 'error',
				code: 'scenario.selection.invalidInteger',
				path: `selection.${key}`,
				message: `Selection field "${key}" must be a positive integer when provided.`,
			});
		}
	}

	if (selection.expandLinks !== undefined && typeof selection.expandLinks !== 'boolean') {
		issues.push({
			severity: 'error',
			code: 'scenario.selection.invalidExpandLinks',
			path: 'selection.expandLinks',
			message: 'Selection field "expandLinks" must be a boolean when provided.',
		});
	}

	return issues;
}

export function validateScenarioSelection(resourceType: string, selection: unknown): DatasetValidationIssue[] {
	if (Array.isArray(selection)) {
		return selection.flatMap((entry, index) =>
			validateScenarioFilterObject(resourceType, entry, `${resourceType}[${index}]`),
		);
	}

	return validateScenarioFilterObject(resourceType, selection, resourceType);
}

function validateScenarioFilterObject(resourceType: string, value: unknown, path: string): DatasetValidationIssue[] {
	if (!isRecord(value)) {
		return [
			{
				severity: 'error',
				code: 'scenario.filter.invalid',
				path,
				message: `Scenario filter "${path}" must be an object.`,
			},
		];
	}

	const definition = SCENARIO_RESOURCE_FILTER_DEFINITIONS[resourceType];
	const issues: DatasetValidationIssue[] = [];

	if (!definition) {
		return issues;
	}

	for (const key of Object.keys(value)) {
		if (!definition.keys.includes(key)) {
			issues.push({
				severity: 'error',
				code: 'scenario.filter.unsupportedKey',
				path: `${path}.${key}`,
				message: `Unsupported filter key "${key}" for ${resourceType}.`,
			});
		}
	}

	if ('age' in value) {
		issues.push(...validateRangeLike(value.age, `${path}.age`, 'age'));
	}

	if ('stayDays' in value) {
		issues.push(...validateRangeLike(value.stayDays, `${path}.stayDays`, 'stayDays'));
	}

	if ('count' in value) {
		issues.push(...validateRangeLike(value.count, `${path}.count`, 'count'));
	}

	if ('samePerson' in value && typeof value.samePerson !== 'boolean') {
		issues.push({
			severity: 'error',
			code: 'scenario.filter.invalidBoolean',
			path: `${path}.samePerson`,
			message: '"samePerson" must be a boolean when provided.',
		});
	}

	return issues;
}

function validateRangeLike(value: unknown, path: string, label: string): DatasetValidationIssue[] {
	if (!isRecord(value)) {
		return [
			{
				severity: 'error',
				code: 'scenario.range.invalid',
				path,
				message: `"${label}" must be an object with one or more of gt/gte/lt/lte.`,
			},
		];
	}

	const issues: DatasetValidationIssue[] = [];
	const keys = Object.keys(value);

	if (keys.length === 0) {
		issues.push({
			severity: 'error',
			code: 'scenario.range.empty',
			path,
			message: `"${label}" must define at least one of gt/gte/lt/lte.`,
		});
	}

	for (const key of keys) {
		if (!SCENARIO_RANGE_KEYS.includes(key as (typeof SCENARIO_RANGE_KEYS)[number])) {
			issues.push({
				severity: 'error',
				code: 'scenario.range.unknownKey',
				path: `${path}.${key}`,
				message: `Unknown range key "${key}".`,
			});
			continue;
		}

		if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) {
			issues.push({
				severity: 'error',
				code: 'scenario.range.invalidValue',
				path: `${path}.${key}`,
				message: `Range value "${key}" must be a finite number.`,
			});
		}
	}

	return issues;
}

function isPositiveInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export type { ScenarioSelection };
