import assert from 'node:assert/strict';
import test from 'node:test';

import {
	hydrateScenarioResultResourceTypes,
	toIndexedResource,
	toSourceResourceRecord,
} from '../src/source-resource-bridge.js';

test('source resource bridge preserves the original source type field while exposing dataset type', () => {
	const sourceResource = {
		id: 'enc-1',
		resourceType: 'encounter',
		type: 'outpatient',
		status: 'finished',
	} as const;

	const indexed = toIndexedResource(sourceResource);

	assert.equal(indexed.type, 'encounter');
	assert.equal(indexed.__resourceType, 'encounter');
	assert.equal(indexed.__sourceRecord.type, 'outpatient');
	assert.equal(Object.keys(indexed).includes('__sourceRecord'), false);

	const restored = toSourceResourceRecord(indexed);

	assert.equal(restored.id, 'enc-1');
	assert.equal(restored.resourceType, 'encounter');
	assert.equal(restored.type, 'outpatient');
	assert.equal(restored.status, 'finished');
	assert.equal(Object.keys(restored).includes('__resourceType'), false);
});

test('source resource bridge can restore a dataset-shaped resource when no original record is attached', () => {
	const restored = toSourceResourceRecord({
		id: 'pat-1',
		type: 'patient',
		name: 'Test Patient',
	} as const);

	assert.equal(restored.id, 'pat-1');
	assert.equal(restored.name, 'Test Patient');
	assert.equal(restored.__resourceType, 'patient');
});

test('scenario result hydration restores internal selectors from grouped resources after JSON fetch', () => {
	const hydrated = hydrateScenarioResultResourceTypes({
		scenarioId: 'test',
		resources: {
			patient: [{ id: '1', name: 'Pat One' }],
			encounter: [{ id: '2', status: 'finished', patientId: '1' }],
		},
		orderedResources: [
			{ id: '1', name: 'Pat One' },
			{ id: '2', status: 'finished', patientId: '1' },
		],
		meta: {
			directMatchCount: 1,
			expandedMatchCount: 2,
			totalResources: 2,
		},
	});

	assert.equal(hydrated.resources.patient[0]?.__resourceType, 'patient');
	assert.equal(hydrated.resources.encounter[0]?.__resourceType, 'encounter');
	assert.equal(hydrated.orderedResources[0]?.__resourceType, 'patient');
	assert.equal(hydrated.orderedResources[1]?.__resourceType, 'encounter');
	assert.equal(Object.keys(hydrated.orderedResources[0] ?? {}).includes('__resourceType'), false);
});
