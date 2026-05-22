import assert from 'node:assert/strict';
import test from 'node:test';

import {
	getBundlePreviewResourceItemsWithDisplays,
	getSourcePreviewResourceItems,
	isLowReadabilityIdentifier,
} from '../src/lib/resource-preview.js';
import { formatSourceResourceType } from '../src/lib/source-resource-display.js';
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

test('source preview titles format multiword FHIR resource types', () => {
	assert.equal(formatSourceResourceType('practitionerrole'), 'PractitionerRole');
	assert.equal(formatSourceResourceType('medicationrequest'), 'MedicationRequest');
	assert.equal(formatSourceResourceType('diagnosticreport'), 'DiagnosticReport');
	assert.equal(formatSourceResourceType('imagingstudy'), 'ImagingStudy');
	assert.equal(formatSourceResourceType('allergyintolerance'), 'AllergyIntolerance');
});

test('source preview subtitles cover medication and report resources', () => {
	const result = attachScenarioResourceMapping(
		{
			scenarioId: 'test',
			resources: {
				medication: [{ id: 'med-1', __resourceType: 'medication', code: 'Med-0001', display: 'Acetaminophen 500 mg' }],
				medicationrequest: [
					{
						id: 'rx-1',
						__resourceType: 'medicationrequest',
						dosageText: 'Take one tablet daily',
						doseValue: 1,
						doseUnit: '{tbl}',
						status: 'active',
					},
				],
				diagnosticreport: [
					{
						id: 'rep-1',
						__resourceType: 'diagnosticreport',
						reportCode: 'Rep-0007',
						categoryCode: 'RAD',
						status: 'final',
					},
				],
				imagingstudy: [
					{
						id: 'img-1',
						__resourceType: 'imagingstudy',
						studyDescription: 'Chest X-ray',
						modalityCode: 'DX',
						status: 'available',
					},
				],
			},
			orderedResources: [
				{ id: 'med-1', __resourceType: 'medication', code: 'Med-0001', display: 'Acetaminophen 500 mg' },
				{
					id: 'rx-1',
					__resourceType: 'medicationrequest',
					dosageText: 'Take one tablet daily',
					doseValue: 1,
					doseUnit: '{tbl}',
					status: 'active',
				},
				{
					id: 'rep-1',
					__resourceType: 'diagnosticreport',
					reportCode: 'Rep-0007',
					categoryCode: 'RAD',
					status: 'final',
				},
				{
					id: 'img-1',
					__resourceType: 'imagingstudy',
					studyDescription: 'Chest X-ray',
					modalityCode: 'DX',
					status: 'available',
				},
			],
			meta: {
				directMatchCount: 4,
				expandedMatchCount: 4,
				totalResources: 4,
			},
		},
		{
			orderedSourceKeys: ['medication/med-1', 'medicationrequest/rx-1', 'diagnosticreport/rep-1', 'imagingstudy/img-1'],
			bundleEntrySourceKeys: [
				'medication/med-1',
				'medicationrequest/rx-1',
				'diagnosticreport/rep-1',
				'imagingstudy/img-1',
			],
		},
	);

	const items = getSourcePreviewResourceItems(result, {
		'medication.code:Med-0001': 'Acetaminophen 500 mg',
		'medicationrequest.doseUnit:{tbl}': 'tablet',
		'medicationrequest.status:active': 'Active',
		'diagnosticreport.reportCode:Rep-0007': 'Chest imaging report',
		'diagnosticreport.categoryCode:RAD': 'Radiology',
		'diagnosticreport.status:final': 'Final',
		'imagingstudy.modalityCode:DX': 'Digital Radiography',
		'imagingstudy.status:available': 'Available',
	});

	assert.equal(items[0]?.subtitle, 'Acetaminophen 500 mg');
	assert.equal(items[1]?.subtitle, 'Take one tablet daily · 1 tablet · Active');
	assert.equal(items[2]?.subtitle, 'Chest imaging report · Radiology · Final');
	assert.equal(items[3]?.subtitle, 'Chest X-ray · Digital Radiography · Available');
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

test('bundle preview titles use primary identifier when resource id is omitted', () => {
	const bundle = {
		resourceType: 'Bundle' as const,
		type: 'collection' as const,
		entry: [
			{
				resource: {
					resourceType: 'Patient',
					identifier: [
						{ value: '1', system: 'https://fhirfox.dev/identifier-system/patient' },
						{ value: 'M139140596', system: 'http://www.moi.gov.tw' },
					],
				},
			},
			{ resource: { resourceType: 'Observation' } },
		],
	};

	const items = getBundlePreviewResourceItemsWithDisplays(bundle);

	assert.equal(items[0]?.title, '1');
	assert.equal(items[1]?.title, '');
});

test('preview titles suppress UUID-like identifiers for readability', () => {
	const uuid = '9a9f5cf1-bf55-4f7b-a8c4-d04c9fbf7e7b';
	const result = attachScenarioResourceMapping(
		{
			scenarioId: 'test',
			resources: {
				patient: [{ id: uuid, __resourceType: 'patient', name: 'Pat' }],
			},
			orderedResources: [{ id: uuid, __resourceType: 'patient', name: 'Pat' }],
			meta: {
				directMatchCount: 1,
				expandedMatchCount: 1,
				totalResources: 1,
			},
		},
		{
			orderedSourceKeys: [`patient/${uuid}`],
			bundleEntrySourceKeys: [`patient/${uuid}`],
		},
	);

	const sourceItems = getSourcePreviewResourceItems(result);
	assert.equal(sourceItems[0]?.title, '');
	assert.equal(sourceItems[0]?.subtitle, 'Pat');

	const bundleItems = getBundlePreviewResourceItemsWithDisplays({
		resourceType: 'Bundle',
		type: 'collection',
		entry: [
			{
				resource: {
					resourceType: 'Patient',
					id: uuid,
					identifier: [{ value: 'P-001', system: 'https://fhirfox.dev/identifier-system/patient' }],
					name: [{ text: 'Pat' }],
				},
			},
		],
	});
	assert.equal(bundleItems[0]?.title, 'P-001');
});

test('low readability identifier detection covers UUID forms only', () => {
	assert.equal(isLowReadabilityIdentifier('9a9f5cf1-bf55-4f7b-a8c4-d04c9fbf7e7b'), true);
	assert.equal(isLowReadabilityIdentifier('urn:uuid:9a9f5cf1-bf55-4f7b-a8c4-d04c9fbf7e7b'), true);
	assert.equal(isLowReadabilityIdentifier('9a9f5cf1bf554f7ba8c4d04c9fbf7e7b'), true);
	assert.equal(isLowReadabilityIdentifier('patient-001'), false);
	assert.equal(isLowReadabilityIdentifier('P-001'), false);
});
