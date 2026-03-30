import assert from 'node:assert/strict';
import test from 'node:test';

import { getCodeDisplayValue, getSourceResourceLinkTarget } from '../src/components/JsonViewer.js';

test('returns the sibling display value for code fields', () => {
	assert.equal(
		getCodeDisplayValue(
			'code',
			['code'],
			'72166-2',
			{
				code: '72166-2',
				display: 'Tobacco smoking status',
			},
			undefined,
			{},
		),
		'Tobacco smoking status',
	);
});

test('ignores non-code fields and missing display values', () => {
	assert.equal(
		getCodeDisplayValue(
			'display',
			['display'],
			'Tobacco smoking status',
			{
				code: '72166-2',
				display: 'Tobacco smoking status',
			},
			undefined,
			{},
		),
		undefined,
	);
	assert.equal(getCodeDisplayValue('code', ['code'], '72166-2', { code: '72166-2' }, undefined, {}), undefined);
});

test('returns source display values for source code fields', () => {
	assert.equal(
		getCodeDisplayValue(
			'conditionCode',
			['conditionCode'],
			'Cond-016',
			{
				conditionCode: 'Cond-016',
			},
			'condition',
			{
				'condition.conditionCode:Cond-016': '感冒/上呼吸道不適',
			},
		),
		'感冒/上呼吸道不適',
	);
});

test('returns source display values for nested source code fields', () => {
	assert.equal(
		getCodeDisplayValue(
			'serviceType',
			['encounter', 'serviceType'],
			'01',
			{
				serviceType: '01',
			},
			'encounter',
			{
				'encounter.serviceType:01': '門診',
			},
		),
		'門診',
	);
	assert.equal(
		getCodeDisplayValue(
			'serviceType',
			['serviceType'],
			'01',
			{
				serviceType: '01',
			},
			'encounter',
			{
				'encounter.serviceType:01': '門診',
			},
		),
		'門診',
	);
	assert.equal(
		getCodeDisplayValue('serviceType', ['serviceType'], '01', { serviceType: '01' }, 'encounter', {}),
		undefined,
	);
});

test('returns source resource keys for reference fields', () => {
	assert.equal(
		getSourceResourceLinkTarget(
			'patientId',
			['encounters', 0, 'patientId'],
			'1',
			{
				patientId: '1',
			},
			'encounter',
			{
				'encounter.patientId': {
					description: '病人 ID。',
					cardinality: '0..1',
					required: false,
					reference: 'patient',
				},
			},
		),
		'patient/1',
	);
	assert.equal(
		getSourceResourceLinkTarget(
			'organization',
			['patients', 0, 'organization'],
			'1',
			{
				organization: '1',
			},
			'patient',
			{
				'patient.organization': {
					description: '管理機構。',
					cardinality: '0..1',
					required: false,
					reference: 'organization',
				},
			},
		),
		'organization/1',
	);
	assert.equal(
		getSourceResourceLinkTarget(
			'id',
			['patients', 0, 'id'],
			'1',
			{
				id: '1',
			},
			'patient',
			{
				'patient.id': {
					description: '病人邏輯 ID。',
					cardinality: '0..1',
					required: true,
				},
			},
		),
		undefined,
	);
	assert.equal(
		getSourceResourceLinkTarget(
			'name',
			['patients', 0, 'name'],
			'王小明',
			{
				name: '王小明',
			},
			'patient',
			{
				'patient.name': {
					description: '病人姓名。',
					cardinality: '0..1',
					required: false,
				},
			},
		),
		undefined,
	);
});

test('returns source resource keys for polymorphic reference fields when sibling type is present', () => {
	assert.equal(
		getSourceResourceLinkTarget(
			'recorderId',
			['conditions', 0, 'recorderId'],
			'1',
			{
				recorderId: '1',
				recorderType: 'practitioner',
			},
			'condition',
			{
				'condition.recorderId': {
					description: '紀錄者。',
					cardinality: '0..1',
					required: false,
					reference: ['patient', 'practitioner', 'practitionerrole', 'relatedperson'],
				},
			},
		),
		'practitioner/1',
	);
	assert.equal(
		getSourceResourceLinkTarget(
			'performerId',
			['procedures', 0, 'performerId'],
			'3',
			{
				performerId: '3',
				performerType: 'organization',
			},
			'procedure',
			{
				'procedure.performerId': {
					description: '執行者。',
					cardinality: '0..1',
					required: false,
					reference: ['device', 'organization', 'patient', 'practitioner', 'practitionerrole', 'relatedperson'],
				},
			},
		),
		'organization/3',
	);
	assert.equal(
		getSourceResourceLinkTarget(
			'recorderId',
			['conditions', 0, 'recorderId'],
			'1',
			{
				recorderId: '1',
			},
			'condition',
			{
				'condition.recorderId': {
					description: '紀錄者。',
					cardinality: '0..1',
					required: false,
					reference: ['patient', 'practitioner', 'practitionerrole', 'relatedperson'],
				},
			},
		),
		undefined,
	);
});
