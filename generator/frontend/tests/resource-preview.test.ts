import assert from 'node:assert/strict';
import test from 'node:test';

import {
	getBundlePreviewResourceItemsWithDisplays,
	getSourcePreviewResourceItems,
} from '../src/lib/resource-preview.js';
import { attachScenarioResourceMapping } from '../src/resource-mapping.js';

test('source preview items preserve explicit source mapping keys', () => {
	const result = attachScenarioResourceMapping(
		{
			scenarioId: 'test',
			resources: {
				patient: [{ id: '3', __resourceType: 'patient', name: 'Pat' }],
				encounter: [{ id: '5', __resourceType: 'encounter', status: 'finished' }],
			},
			orderedResources: [
				{ id: '3', __resourceType: 'patient', name: 'Pat' },
				{ id: '5', __resourceType: 'encounter', status: 'finished' },
			],
			meta: {
				directMatchCount: 1,
				expandedMatchCount: 2,
				totalResources: 2,
			},
		},
		{
			orderedSourceKeys: ['patient/3', 'encounter/5'],
			bundleEntrySourceKeys: ['patient/3', 'encounter/5'],
		},
	);

	const items = getSourcePreviewResourceItems(result);

	assert.deepEqual(
		items.map((item) => item.sourceKey),
		['patient/3', 'encounter/5'],
	);
});

test('bundle preview items follow explicit source-key ordering', () => {
	const bundle = attachScenarioResourceMapping(
		{
			resourceType: 'Bundle',
			type: 'collection',
			entry: [
				{ resource: { resourceType: 'Encounter', id: '5', status: 'finished' } },
				{ resource: { resourceType: 'Patient', id: '3', gender: 'male' } },
				{ resource: { resourceType: 'Encounter', id: '6', status: 'finished' } },
			],
		},
		{
			orderedSourceKeys: ['patient/3', 'encounter/5', 'encounter/6'],
			bundleEntrySourceKeys: ['encounter/5', 'patient/3', 'encounter/6'],
		},
	);

	const items = getBundlePreviewResourceItemsWithDisplays(bundle);

	assert.deepEqual(
		items.map((item) => item.sourceKey),
		['patient/3', 'encounter/5', 'encounter/6'],
	);
	assert.deepEqual(
		items.map((item) => item.resourceType),
		['Patient', 'Encounter', 'Encounter'],
	);
});

test('source preview subtitles prefer display text and dedupe repeated values', () => {
	const result = attachScenarioResourceMapping(
		{
			scenarioId: 'test',
			resources: {
				patient: [{ id: '3', __resourceType: 'patient', name: 'Pat', gender: 'male', birthday: '1980-01-01' }],
				encounter: [
					{ id: '5', __resourceType: 'encounter', serviceType: 'emergency', class: 'EMER', status: 'finished' },
				],
			},
			orderedResources: [
				{ id: '3', __resourceType: 'patient', name: 'Pat', gender: 'male', birthday: '1980-01-01' },
				{ id: '5', __resourceType: 'encounter', serviceType: 'emergency', class: 'EMER', status: 'finished' },
			],
			meta: {
				directMatchCount: 1,
				expandedMatchCount: 2,
				totalResources: 2,
			},
		},
		{
			orderedSourceKeys: ['patient/3', 'encounter/5'],
			bundleEntrySourceKeys: ['patient/3', 'encounter/5'],
		},
	);

	const items = getSourcePreviewResourceItems(result, {
		'patient.gender:male': '男性',
		'encounter.serviceType:emergency': '急診',
		'encounter.class:EMER': '急診',
		'encounter.status:finished': '已完成',
	});

	assert.equal(items[0]?.title, '3');
	assert.equal(items[0]?.subtitle, 'Pat · 男性 · 1980-01-01');
	assert.equal(items[1]?.title, '5');
	assert.equal(items[1]?.subtitle, '急診 · 已完成');
});

test('bundle preview subtitles prefer display text for scalar coded fields', () => {
	const bundle = attachScenarioResourceMapping(
		{
			resourceType: 'Bundle',
			type: 'collection',
			entry: [
				{ resource: { resourceType: 'Patient', id: '3', gender: 'male', birthDate: '1980-01-01' } },
				{
					resource: {
						resourceType: 'Encounter',
						id: '5',
						status: 'finished',
						class: { code: 'EMER', display: '急診' },
						serviceType: { coding: [{ code: 'emergency', display: '急診' }] },
					},
				},
			],
		},
		{
			orderedSourceKeys: ['patient/3', 'encounter/5'],
			bundleEntrySourceKeys: ['patient/3', 'encounter/5'],
		},
	);

	const items = getBundlePreviewResourceItemsWithDisplays(bundle, {
		'patient.gender:male': '男性',
		'encounter.status:finished': '已完成',
	});

	assert.equal(items[0]?.title, '3');
	assert.equal(items[0]?.subtitle, '男性 · 1980-01-01');
	assert.equal(items[1]?.title, '5');
	assert.equal(items[1]?.subtitle, '急診 · 已完成');
});
