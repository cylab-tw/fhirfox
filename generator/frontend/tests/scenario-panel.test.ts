import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCoverageTree } from '../src/components/ScenarioPanel.js';

test('coverage tree displays patient, encounter, and encounter children in the expected shape', () => {
	const tree = buildCoverageTree(
		{
			graph: {
				tree: [
					{
						resourceType: 'patient',
						id: '1',
						children: [
							{
								resourceType: 'organization',
								id: '1',
								children: [],
							},
							{
								resourceType: 'encounter',
								id: '1',
								children: [
									{
										resourceType: 'condition',
										id: '1',
										children: [],
									},
									{
										resourceType: 'allergyintolerance',
										id: '1',
										children: [],
									},
									{
										resourceType: 'observation',
										id: '1',
										children: [],
									},
									{
										resourceType: 'practitionerrole',
										id: '1',
										children: [
											{
												resourceType: 'practitioner',
												id: '1',
												children: [],
											},
										],
									},
									{
										resourceType: 'medicationrequest',
										id: '1',
										children: [
											{
												resourceType: 'medication',
												id: '1',
												children: [],
											},
										],
									},
								],
							},
						],
					},
				],
			},
			resources: {},
			orderedResources: [],
			warnings: [],
			meta: {
				directMatchCount: 0,
				expandedMatchCount: 0,
				totalResources: 0,
			},
			scenarioId: 'test',
		} as never,
		{},
	);

	assert.deepEqual(tree, [
		{
			resourceType: 'patient',
			count: 1,
			children: [
				{
					resourceType: 'organization',
					count: 1,
					children: [],
				},
				{
					resourceType: 'encounter',
					count: 1,
					children: [
						{
							resourceType: 'condition',
							count: 1,
							children: [],
						},
						{
							resourceType: 'allergyintolerance',
							count: 1,
							children: [],
						},
						{
							resourceType: 'observation',
							count: 1,
							children: [],
						},
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
						{
							resourceType: 'medicationrequest',
							count: 1,
							children: [
								{
									resourceType: 'medication',
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

test('coverage tree falls back to encounter for practitioner when no practitioner role is present', () => {
	const tree = buildCoverageTree(
		{
			graph: {
				tree: [
					{
						resourceType: 'patient',
						id: '1',
						children: [
							{
								resourceType: 'encounter',
								id: '1',
								children: [
									{
										resourceType: 'practitioner',
										id: '1',
										children: [],
									},
								],
							},
						],
					},
				],
			},
			resources: {},
			orderedResources: [],
			warnings: [],
			meta: {
				directMatchCount: 0,
				expandedMatchCount: 0,
				totalResources: 0,
			},
			scenarioId: 'test',
		} as never,
		{},
	);

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

test('coverage tree merges split Observation source types for display', () => {
	const tree = buildCoverageTree(
		{
			graph: {
				tree: [
					{
						resourceType: 'patient',
						id: '1',
						children: [
							{
								resourceType: 'encounter',
								id: '1',
								children: [
									{
										resourceType: 'observation-vital-signs',
										id: '1',
										children: [],
									},
									{
										resourceType: 'observation-laboratory-result',
										id: '2',
										children: [],
									},
								],
							},
						],
					},
				],
			},
			resources: {},
			orderedResources: [],
			warnings: [],
			meta: {
				directMatchCount: 0,
				expandedMatchCount: 0,
				totalResources: 0,
			},
			scenarioId: 'test',
		} as never,
		{},
	);

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
							resourceType: 'observation',
							count: 2,
							children: [],
						},
					],
				},
			],
		},
	]);
});
