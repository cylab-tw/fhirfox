import assert from 'node:assert/strict';
import test from 'node:test';

import { createInMemoryDatasetProvider } from '#/provider/index.js';
import { resolveScenario } from '#/resolution/index.js';
import type { Preset } from '#/preset/index.js';
import type { ResourceTypeDefinition } from '#/model/index.js';
import type { ScenarioDefinition } from '#/scenario/index.js';

const resourceTypeDefinitions: ResourceTypeDefinition[] = [
	{
		resourceType: 'practitioner',
		name: 'Practitioner',
		fields: [
			{
				id: 'id',
				name: 'Id',
				type: 'string',
				path: 'Practitioner.id',
				required: true,
			},
		],
	},
	{
		resourceType: 'practitionerrole',
		name: 'PractitionerRole',
		bindings: {
			practitioner: {
				key: 'practitioner',
				name: 'Scenario practitioner',
				resourceTypes: ['practitioner'],
			},
		},
		fields: [
			{
				id: 'id',
				name: 'Id',
				type: 'string',
				path: 'PractitionerRole.id',
				required: true,
			},
			{
				id: 'practitionerId',
				name: 'Practitioner Id',
				type: 'reference',
				path: 'PractitionerRole.practitioner.reference',
				required: false,
				reference: {
					binding: 'practitioner',
				},
			},
		],
	},
	{
		resourceType: 'encounter',
		name: 'Encounter',
		bindings: {
			practitioner: {
				key: 'practitioner',
				name: 'Scenario practitioner',
				resourceTypes: ['practitionerrole', 'practitioner'],
			},
		},
		fields: [
			{
				id: 'id',
				name: 'Id',
				type: 'string',
				path: 'Encounter.id',
				required: true,
			},
			{
				id: 'practitionerId',
				name: 'Practitioner Id',
				type: 'reference',
				path: 'Encounter.participant.individual.reference',
				required: false,
				reference: {
					binding: 'practitioner',
				},
			},
		],
	},
];

const presets: Preset[] = [];

const scenario: ScenarioDefinition = {
	id: 'scenario-role-preference',
	name: 'Scenario role preference',
	resources: [
		{
			alias: 'encounter.current',
			resourceType: 'encounter',
			inputs: {
				id: 'encounter-1',
			},
			references: {
				practitionerId: 'practitioner.alice',
			},
		},
		{
			alias: 'practitionerrole.alice-role',
			resourceType: 'practitionerrole',
			inputs: {
				id: 'practitionerrole-1',
			},
			references: {
				practitionerId: 'practitioner.alice',
			},
		},
		{
			alias: 'practitioner.alice',
			resourceType: 'practitioner',
			inputs: {
				id: 'practitioner-1',
			},
		},
	],
};

test('encounter practitioner references prefer the matching practitionerrole when present', async () => {
	const provider = createInMemoryDatasetProvider({
		resourceTypeDefinitions,
		presets,
	});

	const result = await resolveScenario(provider, scenario, {
		seed: 'test-seed',
		generatedAt: '2026-05-11T00:00:00.000Z',
	});

	const encounter = result.resources.find((resource) => resource.alias === 'encounter.current');
	const practitionerRole = result.resources.find((resource) => resource.alias === 'practitionerrole.alice-role');
	const practitioner = result.resources.find((resource) => resource.alias === 'practitioner.alice');

	assert.ok(encounter);
	assert.ok(practitionerRole);
	assert.ok(practitioner);

	assert.equal(encounter?.resource.practitionerId, practitionerRole?.resource.id);
	assert.equal(practitionerRole?.resource.practitionerId, practitioner?.resource.id);
});

test('scenario resolution derives deterministic generation from the scenario id', async () => {
	const provider = createInMemoryDatasetProvider({
		resourceTypeDefinitions: [
			{
				resourceType: 'sample',
				name: 'Sample',
				fields: [
					{
						id: 'id',
						name: 'Id',
						type: 'string',
						path: 'Sample.id',
						required: true,
					},
					{
						id: 'value',
						name: 'Value',
						type: 'number',
						path: 'Sample.value',
						required: false,
						default: '$random()',
					},
				],
			},
		],
		presets,
	});
	const baseScenario: ScenarioDefinition = {
		id: 'scenario-random-a',
		name: 'Scenario random A',
		resources: [
			{
				alias: 'sample.one',
				resourceType: 'sample',
			},
		],
	};
	const matchingSeedOptions = {
		seed: 'test-seed',
		generatedAt: '2026-05-11T00:00:00.000Z',
	};

	const first = await resolveScenario(provider, baseScenario, matchingSeedOptions);
	const repeat = await resolveScenario(provider, baseScenario, matchingSeedOptions);
	const otherScenario = await resolveScenario(
		provider,
		{
			...baseScenario,
			id: 'scenario-random-b',
			name: 'Scenario random B',
		},
		matchingSeedOptions,
	);

	assert.equal(first.resources[0]?.resource.value, repeat.resources[0]?.resource.value);
	assert.notEqual(first.resources[0]?.resource.value, otherScenario.resources[0]?.resource.value);
	assert.equal(first.metadata.seed, 'test-seed');
});
