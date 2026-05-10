import assert from 'node:assert/strict';
import test from 'node:test';

import { compileResourceDefinitions } from '#/model/index.js';
import { createInMemoryDatasetProvider } from '#/provider/index.js';
import { resolveScenario } from '#/resolution/index.js';

test('compileResourceDefinitions preserves authored optional values', () => {
	const compiled = compileResourceDefinitions({
		definitions: [
			{
				resourceType: 'patient',
				name: 'Patient',
				fields: [
					{
						id: 'id',
						name: 'ID',
						type: 'string',
						path: 'Patient.id',
						required: true,
					},
				],
			},
		],
	});

	assert.equal(compiled.resourceTypeDefinitions[0]?.defaults, undefined);
	assert.equal(compiled.resourceTypeDefinitions[0]?.fields[0]?.emit, undefined);
});

test('binding-backed references can create implicit supporting resources', async () => {
	const provider = createInMemoryDatasetProvider({
		resourceTypeDefinitions: [
			{
				resourceType: 'organization',
				name: 'Organization',
				fields: [
					{
						id: 'id',
						name: 'ID',
						type: 'string',
						path: 'Organization.id',
						required: true,
					},
				],
			},
			{
				resourceType: 'patient',
				name: 'Patient',
				bindings: {
					organization: {
						name: 'Organization',
						resourceTypes: ['organization'],
					},
				},
				fields: [
					{
						id: 'id',
						name: 'ID',
						type: 'string',
						path: 'Patient.id',
						required: true,
					},
					{
						id: 'organizationId',
						name: 'Organization',
						type: 'reference',
						path: 'Patient.managingOrganization.reference',
						required: false,
						reference: {
							binding: 'organization',
						},
					},
				],
			},
		],
		presets: [],
	});

	const resolved = await resolveScenario(
		provider,
		{
			id: 'implicit-organization',
			name: 'Implicit Organization',
			resources: [
				{
					alias: 'patient.current',
					resourceType: 'patient',
					as: ['organization'],
				},
			],
		},
		{ seed: 'demo' },
	);

	const patient = resolved.resources.find((resource) => resource.alias === 'patient.current');
	const organization = resolved.resources.find((resource) => resource.alias === 'patient.organization');

	assert.equal(resolved.resources.length, 2);
	assert.equal(organization?.origin, 'implicit');
	assert.deepEqual(
		resolved.resources.map((resource) => resource.alias),
		['patient.current', 'patient.organization'],
	);
	assert.equal(patient?.resource.organizationId, organization?.resource.id);
});
