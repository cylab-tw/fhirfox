/* eslint-disable sort-imports */
import assert from 'node:assert/strict';
import test from 'node:test';

import { validateResourceDefinitions } from '#/model/index.js';
import { validatePresets } from '#/preset/index.js';
import { validateScenario } from '#/scenario/index.js';
import { createValidationReport } from '#/validation/index.js';
import type { ScenarioDefinition } from '#/scenario/index.js';

test('resource validation reports unknown generators', () => {
	const issues = validateResourceDefinitions([
		{
			resourceType: 'patient',
			name: 'Patient',
			fields: [
				{
					id: 'name',
					name: 'Name',
					type: 'string',
					path: 'patient.name',
					required: true,
					default: '$missing()',
				},
			],
		},
	]);

	assert.ok(issues.some((issue) => issue.code === 'resource.unknownGenerator'));
});

test('preset validation reports unknown generators', () => {
	const issues = validatePresets(
		[
			{
				id: 'patient.demo',
				resourceType: 'patient',
				fields: {
					name: { value: '$missing()' },
				},
			},
		],
		[
			{
				resourceType: 'patient',
				name: 'Patient',
				fields: [
					{
						id: 'name',
						name: 'Name',
						type: 'string',
						path: 'patient.name',
						required: true,
					},
				],
			},
		],
	);

	assert.ok(issues.some((issue) => issue.code === 'preset.unknownGenerator'));
});

test('scenario validation reports unknown generators and presets', () => {
	const issues = validateScenario(
		{
			id: 'scenario-1',
			name: 'Scenario',
			resources: [
				{
					alias: 'patient.current',
					resourceType: 'patient',
					with: ['missing-preset'],
					inputs: {
						name: '$missing()',
					},
				},
			],
		},
		[
			{
				resourceType: 'patient',
				name: 'Patient',
				fields: [
					{
						id: 'name',
						name: 'Name',
						type: 'string',
						path: 'patient.name',
						required: true,
					},
				],
			},
		],
		[
			{
				id: 'patient.demo',
				resourceType: 'patient',
				fields: {},
			},
		],
	);

	assert.ok(issues.some((issue) => issue.code === 'scenario.unknownGenerator'));
	assert.ok(issues.some((issue) => issue.code === 'scenario.unknownPreset'));
});

test('scenario validation reports unknown resource types and unsupported properties', () => {
	const resource = {
		alias: 'patient.current',
		resourceType: 'patient',
		alsoMissing: 'value',
	} as ScenarioDefinition['resources'][number] & { alsoMissing: string };

	const issues = validateScenario(
		{
			id: 'scenario-1',
			name: 'Scenario',
			resources: [resource, { alias: 'other', resourceType: 'missing' }],
		},
		[
			{
				resourceType: 'patient',
				name: 'Patient',
				fields: [
					{
						id: 'name',
						name: 'Name',
						type: 'string',
						path: 'patient.name',
						required: true,
					},
				],
			},
		],
	);

	assert.ok(issues.some((issue) => issue.code === 'scenario.unknownResourceProperty'));
	assert.ok(issues.some((issue) => issue.code === 'scenario.unknownResourceType'));
});

test('scenario validation reports invalid references', () => {
	const issues = validateScenario(
		{
			id: 'scenario-1',
			name: 'Scenario',
			resources: [
				{
					alias: 'encounter.current',
					resourceType: 'encounter',
					references: {
						patientId: 'patient.missing',
					},
				},
			],
		},
		[
			{
				resourceType: 'encounter',
				name: 'Encounter',
				bindings: {
					subject: {
						name: 'Subject',
						resourceTypes: ['patient'],
					},
				},
				fields: [
					{
						id: 'patientId',
						name: 'Patient',
						type: 'reference',
						path: 'encounter.patientId',
						required: true,
						reference: { binding: 'subject' },
					},
				],
			},
			{
				resourceType: 'patient',
				name: 'Patient',
				fields: [],
			},
		],
	);

	assert.ok(issues.some((issue) => issue.code === 'scenario.unknownReferenceAlias'));
});

test('validation report counts errors and warnings', () => {
	const report = createValidationReport([
		{ severity: 'error', code: 'test.error', message: 'error' },
		{ severity: 'warning', code: 'test.warning', message: 'warning' },
	]);

	assert.equal(report.errorCount, 1);
	assert.equal(report.warningCount, 1);
});
