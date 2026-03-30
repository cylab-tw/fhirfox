import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCoverageTree } from '../src/components/ScenarioPanel.js';

test('coverage tree nests practitioner under encounter when no practitioner role is present', () => {
	const tree = buildCoverageTree({
		patient: 1,
		encounter: 2,
		practitioner: 1,
		condition: 1,
	});

	assert.deepEqual(tree, [
		{
			resourceType: 'patient',
			count: 1,
			children: [
				{
					resourceType: 'encounter',
					count: 2,
					children: [
						{
							resourceType: 'condition',
							count: 1,
							children: [],
						},
						{
							resourceType: 'practitioner',
							count: 1,
							children: [],
						},
					],
				},
			],
		},
	]);
});

test('coverage tree keeps practitioner nested under practitioner role when that role is present', () => {
	const tree = buildCoverageTree({
		patient: 1,
		encounter: 1,
		practitionerrole: 1,
		practitioner: 1,
	});

	assert.deepEqual(tree, [
		{
			resourceType: 'patient',
			count: 1,
			children: [
				{
					resourceType: 'encounter',
					count: 1,
					children: [
						{
							resourceType: 'practitionerrole',
							count: 1,
							children: [
								{
									resourceType: 'practitioner',
									count: 1,
									children: [],
								},
							],
						},
					],
				},
			],
		},
	]);
});
