import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';

import { readYamlDirectory } from '#/cli/files.js';
import { compileResourceDefinitions } from '#/model/index.js';
import { createInMemoryDatasetProvider } from '#/provider/index.js';
import { resolveScenario } from '#/resolution/index.js';
import type { Preset } from '#/preset/index.js';
import type { ResourceTypeDefinition } from '#/model/index.js';

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

test('binding-backed references use authored scenario resources without synthesizing optional records', async () => {
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
			id: 'authored-organization',
			name: 'Authored Organization',
			resources: [
				{
					alias: 'organization.hospital',
					resourceType: 'organization',
					as: ['patient.organization'],
				},
				{
					alias: 'patient.current',
					resourceType: 'patient',
				},
			],
		},
		{ seed: 'demo' },
	);

	const patient = resolved.resources.find((resource) => resource.alias === 'patient.current');
	const organization = resolved.resources.find((resource) => resource.alias === 'organization.hospital');

	assert.equal(resolved.resources.length, 2);
	assert.equal(organization?.origin, 'explicit');
	assert.deepEqual(
		resolved.resources.map((resource) => resource.alias),
		['organization.hospital', 'patient.current'],
	);
	assert.equal(patient?.resource.organizationId, organization?.resource.id);
});

test('preset requirements can create implicit supporting resources', async () => {
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
		presets: [
			{
				id: 'patient.with-organization',
				resourceType: 'patient',
				requires: [
					{
						alias: 'organization.hospital',
						resourceType: 'organization',
					},
				],
			},
		],
	});

	const resolved = await resolveScenario(
		provider,
		{
			id: 'required-organization',
			name: 'Required Organization',
			resources: [
				{
					alias: 'patient.current',
					resourceType: 'patient',
					with: ['patient.with-organization'],
				},
			],
		},
		{ seed: 'demo' },
	);

	const organization = resolved.resources.find((resource) => resource.alias === 'organization.hospital');

	assert.equal(resolved.resources.length, 2);
	assert.equal(organization?.origin, 'implicit');
	assert.deepEqual(
		resolved.resources.map((resource) => resource.alias),
		['patient.current', 'organization.hospital'],
	);
});

test('bundled default hospital preset uses the TW Core organization code for its name', async () => {
	const provider = createInMemoryDatasetProvider({
		resourceTypeDefinitions: readYamlDirectory<ResourceTypeDefinition>(resolve('../../dataset/definitions')),
		presets: readYamlDirectory<Preset>(resolve('../../dataset/presets')),
	});

	const resolved = await resolveScenario(
		provider,
		{
			id: 'default-hospital-identifier',
			name: 'Default hospital identifier',
			resources: [
				{
					alias: 'organization.default',
					resourceType: 'organization',
					with: ['organization.default-hospital'],
				},
			],
		},
		{ seed: 'demo' },
	);

	const organization = resolved.resources.find((resource) => resource.alias === 'organization.default');

	assert.equal(organization?.resource.name, '臺北市立聯合醫院');
	assert.equal(organization?.resource.identifierValue, '0101090517');
});
