import assert from 'node:assert/strict';
import test from 'node:test';

import { createScenarioService, normalizeScenario } from '../src/index.js';

import type { DatasetProvider, Resource, ResourceLinks } from '../src/index.js';

const defaultResources: Resource[] = [
	{
		id: 'patient-1',
		type: 'patient',
		mrn: 'P001',
		name: 'Alice',
	},
	{
		id: 'encounter-1',
		type: 'encounter',
		patient_id: 'patient-1',
		status: 'finished',
	},
	{
		id: 'condition-1',
		type: 'condition',
		conditionCode: 'I20',
		encounter_id: 'encounter-1',
	},
];

const defaultLinks: ResourceLinks = [
	{
		sourceType: 'condition',
		field: 'encounter_id',
		targetTypes: ['encounter'],
	},
	{
		sourceType: 'encounter',
		field: 'patient_id',
		targetTypes: ['patient'],
	},
];

test('dataset package resolves a scenario with direct matches and linked resources', async () => {
	const scenario = normalizeScenario({
		id: 'TWCORE-OPD-001',
		name: 'General Outpatient',
		type: 'outpatient',
		level: 1,
		summary: 'Adult outpatient encounter with linked resources.',
		condition: {
			conditionCode: 'I20',
		},
	});

	const service = createTestScenarioService([scenario]);

	const result = await service.resolveScenario('TWCORE-OPD-001');

	assert.equal(result.scenario.id, 'TWCORE-OPD-001');
	assert.equal(result.scenario.level, 1);
	assert.equal(result.meta?.directMatchCount, 1);
	assert.equal(result.meta?.expandedMatchCount, 3);
	assert.deepEqual(result.warnings, undefined);
	assert.deepEqual(
		result.resources.condition?.map((resource) => resource.id),
		['condition-1'],
	);
	assert.deepEqual(
		result.resources.encounter?.map((resource) => resource.id),
		['encounter-1'],
	);
	assert.deepEqual(
		result.resources.patient?.map((resource) => resource.id),
		['patient-1'],
	);
});

test('dataset package resolves reverse links from a patient seed', async () => {
	const scenario = normalizeScenario({
		id: 'TWCORE-OPD-002',
		name: 'Patient Seed',
		type: 'outpatient',
		patient: {
			name: 'Alice',
		},
	});

	const service = createTestScenarioService([scenario]);

	const result = await service.resolveScenario('TWCORE-OPD-002');

	assert.equal(result.meta?.directMatchCount, 1);
	assert.equal(result.meta?.expandedMatchCount, 3);
	assert.deepEqual(
		result.resources.patient?.map((resource) => resource.id),
		['patient-1'],
	);
	assert.deepEqual(
		result.resources.encounter?.map((resource) => resource.id),
		['encounter-1'],
	);
	assert.deepEqual(
		result.resources.condition?.map((resource) => resource.id),
		['condition-1'],
	);
});

test('dataset package reports missing linked resources as warnings', async () => {
	const resources: Resource[] = [
		{
			id: 'condition-1',
			type: 'condition',
			conditionCode: 'I20',
			encounter_id: 'encounter-missing',
		},
	];

	const links: ResourceLinks = [{ sourceType: 'condition', field: 'encounter_id', targetTypes: ['encounter'] }];

	const scenario = normalizeScenario({
		id: 'TWCORE-OPD-003',
		name: 'Missing Link',
		type: 'outpatient',
		condition: {
			conditionCode: 'I20',
		},
	});

	const service = createTestScenarioService([scenario], resources, links);

	const result = await service.resolveScenario('TWCORE-OPD-003');

	assert.equal(result.meta?.directMatchCount, 1);
	assert.equal(result.meta?.expandedMatchCount, 1);
	assert.deepEqual(
		result.resources.condition?.map((resource) => resource.id),
		['condition-1'],
	);
	assert.deepEqual(result.warnings, [
		'Missing linked resource encounter/encounter-missing from condition/condition-1 via encounter_id.',
	]);
});

test('dataset package resolves reverse links from array-valued link fields', async () => {
	const resources: Resource[] = [
		{
			id: 'patient-1',
			type: 'patient',
			mrn: 'P001',
			name: 'Alice',
		},
		{
			id: 'encounter-1',
			type: 'encounter',
			patient_ids: ['patient-1', 'patient-2'],
			status: 'finished',
		},
	];

	const links: ResourceLinks = [{ sourceType: 'encounter', field: 'patient_ids', targetTypes: ['patient'] }];

	const scenario = normalizeScenario({
		id: 'TWCORE-OPD-004',
		name: 'Array Reverse Link',
		type: 'outpatient',
		patient: {
			name: 'Alice',
		},
	});

	const service = createTestScenarioService([scenario], resources, links);

	const result = await service.resolveScenario('TWCORE-OPD-004');

	assert.equal(result.meta?.directMatchCount, 1);
	assert.equal(result.meta?.expandedMatchCount, 2);
	assert.deepEqual(
		result.resources.patient?.map((resource) => resource.id),
		['patient-1'],
	);
	assert.deepEqual(
		result.resources.encounter?.map((resource) => resource.id),
		['encounter-1'],
	);
});

test('dataset package warns when a scenario produces no direct matches', async () => {
	const scenario = normalizeScenario({
		id: 'TWCORE-OPD-005',
		name: 'No Direct Match',
		type: 'outpatient',
		condition: {
			conditionCode: 'missing-code',
		},
	});

	const service = createTestScenarioService([scenario]);

	const result = await service.resolveScenario('TWCORE-OPD-005');

	assert.equal(result.meta?.directMatchCount, 0);
	assert.equal(result.meta?.expandedMatchCount, 0);
	assert.deepEqual(result.resources, {});
	assert.deepEqual(result.warnings, ['Scenario produced no direct matches, so linked expansion was skipped.']);
});

test('dataset package resolves polymorphic links when the target id matches exactly one allowed type', async () => {
	const resources: Resource[] = [
		{ id: 'patient-1', type: 'patient', name: 'Alice' },
		{ id: 'encounter-1', type: 'encounter', patientId: 'patient-1' },
		{
			id: 'observation-1',
			type: 'observation',
			encounterId: 'encounter-1',
			patientId: 'patient-1',
			performerId: 'patient-1',
		},
	];
	const links: ResourceLinks = [
		{ sourceType: 'encounter', field: 'patientId', targetTypes: ['patient'] },
		{ sourceType: 'observation', field: 'patientId', targetTypes: ['patient'] },
		{ sourceType: 'observation', field: 'encounterId', targetTypes: ['encounter'] },
		{ sourceType: 'observation', field: 'performerId', targetTypes: ['patient', 'practitioner'] },
	];

	const scenario = normalizeScenario({
		id: 'TWCORE-OPD-006',
		name: 'Polymorphic performer',
		type: 'outpatient',
		patient: { name: 'Alice' },
	});

	const service = createTestScenarioService([scenario], resources, links);
	const result = await service.resolveScenario('TWCORE-OPD-006');

	assert.deepEqual(
		result.resources.observation?.map((resource) => resource.id),
		['observation-1'],
	);
	assert.deepEqual(result.warnings, undefined);
});

test('dataset package warns and skips ambiguous polymorphic links', async () => {
	const resources: Resource[] = [
		{ id: 'shared-1', type: 'patient', name: 'Alice' },
		{ id: 'shared-1', type: 'practitioner', name: 'Dr. Alice' },
		{ id: 'observation-1', type: 'observation', performerId: 'shared-1' },
	];
	const links: ResourceLinks = [
		{ sourceType: 'observation', field: 'performerId', targetTypes: ['patient', 'practitioner'] },
	];

	const scenario = normalizeScenario({
		id: 'TWCORE-OPD-007',
		name: 'Ambiguous polymorphic performer',
		type: 'outpatient',
		patient: { id: 'shared-1' },
	});

	const service = createTestScenarioService([scenario], resources, links);
	const result = await service.resolveScenario('TWCORE-OPD-007');

	assert.equal(result.resources.observation, undefined);
	assert.deepEqual(result.warnings, [
		'Ambiguous linked resource id "shared-1" for observation.performerId; matched target types: patient, practitioner.',
	]);
});

test('dataset package uses explicit reference types to resolve ambiguous polymorphic links', async () => {
	const resources: Resource[] = [
		{ id: 'shared-1', type: 'patient', name: 'Alice' },
		{ id: 'shared-1', type: 'practitioner', name: 'Dr. Alice' },
		{
			id: 'observation-1',
			type: 'observation',
			patientId: 'shared-1',
			performerId: 'shared-1',
			performerType: 'practitioner',
		},
	];
	const links: ResourceLinks = [
		{ sourceType: 'observation', field: 'patientId', targetTypes: ['patient'] },
		{ sourceType: 'observation', field: 'performerId', targetTypes: ['patient', 'practitioner'] },
	];

	const scenario = normalizeScenario({
		id: 'TWCORE-OPD-008',
		name: 'Typed polymorphic performer',
		type: 'outpatient',
		patient: { id: 'shared-1' },
	});

	const service = createTestScenarioService([scenario], resources, links);
	const result = await service.resolveScenario('TWCORE-OPD-008');

	assert.deepEqual(
		result.resources.observation?.map((resource) => resource.id),
		['observation-1'],
	);
	assert.deepEqual(result.warnings, undefined);
});

function createTestScenarioService(
	scenarios: ReturnType<typeof normalizeScenario>[],
	resources: Resource[] = defaultResources,
	links: ResourceLinks = defaultLinks,
) {
	return createScenarioService({
		provider: createMockProvider(resources, links),
		scenarios,
	});
}

function createMockProvider(resources: Resource[], links: ResourceLinks): DatasetProvider {
	return {
		async queryResources(resourceType, filter) {
			return resources.filter((resource) => {
				if (resource.type !== resourceType) {
					return false;
				}

				if (!filter) {
					return true;
				}

				return Object.entries(filter).every(([key, expected]) => resource[key] === expected);
			});
		},
		listResourceLinks() {
			return links;
		},
		async queryLinkedResources(resourceType, field, targetId) {
			return resources.filter((resource) => {
				if (resource.type !== resourceType) {
					return false;
				}

				const value = resource[field];

				if (typeof value === 'string') {
					return value === targetId;
				}

				if (Array.isArray(value)) {
					return value.some((entry) => entry === targetId);
				}

				return false;
			});
		},
	};
}
