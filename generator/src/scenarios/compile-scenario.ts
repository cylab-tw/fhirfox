import type {
	ScenarioAnchorInput,
	ScenarioDefinition,
	ScenarioFieldConstraintInput,
	ScenarioFieldInput,
	ScenarioPredicate,
	ScenarioQueryPlan,
	ScenarioResourceBlockInput,
	ScenarioSort,
	ScenarioValue,
} from './types.js';

const RESOURCE_TYPE_ALIASES: Record<string, string> = {
	patient: 'Patient',
	encounter: 'Encounter',
	organization: 'Organization',
	practitioner: 'Practitioner',
	practitionerrole: 'PractitionerRole',
	condition: 'Condition',
	medication: 'MedicationRequest',
	medicationrequest: 'MedicationRequest',
	observation: 'Observation',
	procedure: 'Procedure',
	diagnosticreport: 'DiagnosticReport',
	imagingstudy: 'ImagingStudy',
	allergy: 'AllergyIntolerance',
	'allergy-intolerance': 'AllergyIntolerance',
	allergyintolerance: 'AllergyIntolerance',
};

const RESERVED_KEYS = new Set([
	'id',
	'name',
	'level',
	'description',
	'focus',
	'journey',
	'type',
	'department',
	'anchor',
	'criteria',
	'resources',
]);

const DEFAULT_TYPE_ANCHORS: Record<string, ScenarioAnchorInput> = {
	outpatient: {
		resourceType: 'Encounter',
		sort: {
			field: 'period_start',
			direction: 'desc',
		},
	},
	emergency: {
		resourceType: 'Encounter',
		sort: {
			field: 'period_start',
			direction: 'desc',
		},
	},
	inpatient: {
		resourceType: 'Encounter',
		sort: {
			field: 'period_start',
			direction: 'desc',
		},
	},
};

const DEFAULT_TYPE_PREDICATES: Record<string, ScenarioPredicate[]> = {
	outpatient: [
		{
			resourceType: 'Encounter',
			field: 'class',
			operator: 'eq',
			value: 'AMB',
		},
	],
	emergency: [
		{
			resourceType: 'Encounter',
			field: 'class',
			operator: 'eq',
			value: 'EMER',
		},
	],
	inpatient: [
		{
			resourceType: 'Encounter',
			field: 'class',
			operator: 'eq',
			value: 'IMP',
		},
	],
};

const DEFAULT_LIST_FIELDS: Record<string, string> = {
	Condition: 'code',
	MedicationRequest: 'medication',
	Observation: 'code',
	Procedure: 'code',
	DiagnosticReport: 'code',
	ImagingStudy: 'identifier',
	AllergyIntolerance: 'code',
};

function canonicalizeResourceType(value: string): string {
	const normalized = value.replace(/[^a-z0-9]/gi, '').toLowerCase();

	return RESOURCE_TYPE_ALIASES[normalized] ?? value;
}

function normalizeConstraintInput(value: ScenarioFieldInput): ScenarioFieldConstraintInput {
	if (Array.isArray(value)) {
		return { in: value };
	}

	if (value === null || value === undefined || typeof value !== 'object') {
		return { eq: value as ScenarioValue };
	}

	return value;
}

function compilePredicatesFromCriteria(criteria: ScenarioDefinition['criteria']): ScenarioPredicate[] {
	if (!criteria) {
		return [];
	}

	const predicates: ScenarioPredicate[] = [];

	for (const [resourceKey, fieldMap] of Object.entries(criteria)) {
		const resourceType = canonicalizeResourceType(resourceKey);

		for (const [field, rawConstraint] of Object.entries(fieldMap)) {
			const constraint = normalizeConstraintInput(rawConstraint);

			if (constraint.eq !== undefined) {
				predicates.push({
					resourceType,
					field,
					operator: 'eq',
					value: constraint.eq,
				});
			}

			if (constraint.in !== undefined) {
				predicates.push({
					resourceType,
					field,
					operator: 'in',
					value: constraint.in,
				});
			}

			if (constraint.min !== undefined) {
				predicates.push({
					resourceType,
					field,
					operator: 'gte',
					value: constraint.min,
				});
			}

			if (constraint.max !== undefined) {
				predicates.push({
					resourceType,
					field,
					operator: 'lte',
					value: constraint.max,
				});
			}
		}
	}

	return predicates;
}

function extractShorthandCriteria(scenario: ScenarioDefinition): Record<string, ScenarioResourceBlockInput> {
	const shorthandCriteria: Record<string, ScenarioResourceBlockInput> = {};

	for (const [key, value] of Object.entries(scenario)) {
		if (RESERVED_KEYS.has(key) || value === null || value === undefined) {
			continue;
		}

		const resourceType = canonicalizeResourceType(key);
		if (resourceType === key && !RESOURCE_TYPE_ALIASES[normalizeLookupKey(key)]) {
			continue;
		}

		if (Array.isArray(value)) {
			const defaultField = DEFAULT_LIST_FIELDS[resourceType];
			if (!defaultField) {
				continue;
			}

			shorthandCriteria[resourceType] = {
				...(shorthandCriteria[resourceType] ?? {}),
				[defaultField]: value as ScenarioValue[],
			};
			continue;
		}

		if (typeof value === 'object') {
			shorthandCriteria[resourceType] = {
				...(shorthandCriteria[resourceType] ?? {}),
				...(value as ScenarioResourceBlockInput),
			};
		}
	}

	return shorthandCriteria;
}

function mergeCriteria(scenario: ScenarioDefinition): Record<string, ScenarioResourceBlockInput> {
	const explicitCriteria = Object.fromEntries(
		Object.entries(scenario.criteria ?? {}).map(([resourceType, fieldMap]) => [
			canonicalizeResourceType(resourceType),
			fieldMap,
		]),
	) as Record<string, ScenarioResourceBlockInput>;
	const shorthandCriteria = extractShorthandCriteria(scenario);

	return Object.fromEntries(
		[...new Set([...Object.keys(shorthandCriteria), ...Object.keys(explicitCriteria)])].map((resourceType) => [
			resourceType,
			{
				...(shorthandCriteria[resourceType] ?? {}),
				...(explicitCriteria[resourceType] ?? {}),
			},
		]),
	);
}

function compileSort(
	anchorResourceType: string,
	sortInput: ScenarioAnchorInput['sort'] | undefined,
): ScenarioSort | null {
	if (!sortInput) {
		return null;
	}

	return {
		resourceType: anchorResourceType,
		field: sortInput.field,
		direction: sortInput.direction ?? 'asc',
	};
}

function normalizeLookupKey(value: string): string {
	return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function inferAnchor(scenario: ScenarioDefinition): ScenarioAnchorInput {
	if (scenario.anchor?.resourceType) {
		return scenario.anchor;
	}

	const inferred = (scenario.type ? DEFAULT_TYPE_ANCHORS[scenario.type] : undefined) ?? DEFAULT_TYPE_ANCHORS.outpatient;

	return {
		...inferred,
		limit: scenario.anchor?.limit ?? inferred.limit,
	};
}

function inferIncludeResourceTypes(
	scenario: ScenarioDefinition,
	anchorResourceType: string,
	mergedCriteria: Record<string, ScenarioResourceBlockInput>,
): string[] {
	const explicitIncludes =
		scenario.resources?.include?.map((resourceType) => canonicalizeResourceType(resourceType)) ?? [];
	const shorthandIncludes = Object.keys(mergedCriteria).map((resourceType) => canonicalizeResourceType(resourceType));

	return [anchorResourceType, ...new Set([...explicitIncludes, ...shorthandIncludes])].filter(
		(resourceType, index, values) => values.indexOf(resourceType) === index,
	);
}

export function compileScenarioDefinition(scenario: ScenarioDefinition): ScenarioQueryPlan {
	const anchor = inferAnchor(scenario);
	const anchorResourceType = canonicalizeResourceType(anchor.resourceType);
	const mergedCriteria = mergeCriteria(scenario);
	const predicates = [
		...(scenario.type ? (DEFAULT_TYPE_PREDICATES[scenario.type] ?? []) : []),
		...compilePredicatesFromCriteria(mergedCriteria),
	];

	return {
		id: scenario.id,
		name: scenario.name ?? scenario.id,
		level: scenario.level ?? 1,
		description: scenario.description ?? null,
		anchorResourceType,
		anchorLimit: anchor.limit ?? 20,
		sort: compileSort(anchorResourceType, anchor.sort),
		predicates,
		includeResourceTypes: inferIncludeResourceTypes(scenario, anchorResourceType, mergedCriteria),
	};
}
