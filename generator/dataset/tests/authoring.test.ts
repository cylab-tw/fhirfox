import assert from 'node:assert/strict';
import { parse } from 'yaml';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
	SCENARIO_CANONICAL_METADATA_KEYS,
	SCENARIO_COMMON_FILTER_KEYS,
	SCENARIO_RANGE_KEYS,
	SCENARIO_RESOURCE_KEYS,
	SCENARIO_SELECTION_KEYS,
} from '../src/scenario/authoring.js';
import {
	buildSourceAuthoringSchema,
	deriveResourceLinks,
	validateDatasetAuthoring,
	validateScenarioDocument,
} from '../src/index.js';

test('source authoring schema infers required fields from cardinality and keeps field metadata', () => {
	const schema = buildSourceAuthoringSchema([
		{
			patient: {
				label: '病人',
				description: 'Patient source model',
				cardinality: '0..*',
				id: {
					description: 'Patient id',
					cardinality: '1..1',
					fhirMapping: 'Patient.id',
				},
				organization: {
					description: 'Managing org',
					cardinality: '0..1',
					fhirMapping: 'Patient.managingOrganization.reference',
					reference: 'organization',
				},
			},
		},
	]);

	assert.equal(schema.models.patient.fields.id.required, true);
	assert.equal(schema.models.patient.fields.id.fhirMapping, 'Patient.id');
	assert.equal(schema.models.patient.fields.organization.reference, 'organization');
	assert.equal(schema.models.patient.fields.organization.fhirMapping, 'Patient.managingOrganization.reference');
});

test('source authoring schema supports polymorphic reference metadata', () => {
	const schema = buildSourceAuthoringSchema([
		{
			observation: {
				description: 'Observation source model',
				cardinality: '0..*',
				id: { description: 'Observation id', cardinality: '1..1' },
				performerId: {
					description: 'Performer id',
					cardinality: '0..1',
					reference: ['patient', 'practitioner'],
				},
			},
		},
	]);

	assert.deepEqual(schema.models.observation.fields.performerId.reference, ['patient', 'practitioner']);
});

test('resource links can be derived from reference metadata', () => {
	const schema = buildSourceAuthoringSchema([
		{
			observation: {
				description: 'Observation source model',
				cardinality: '0..*',
				id: { description: 'Observation id', cardinality: '1..1' },
				performerId: {
					description: 'Performer id',
					cardinality: '0..1',
					reference: ['patient', 'practitioner'],
				},
			},
		},
	]);

	assert.deepEqual(deriveResourceLinks(schema), [
		{
			sourceType: 'observation',
			field: 'performerId',
			targetTypes: ['patient', 'practitioner'],
		},
	]);
});

test('dataset authoring validation reports unknown fields, missing required values, and broken references', () => {
	const schema = buildSourceAuthoringSchema([
		{
			patient: {
				description: 'Patient source model',
				cardinality: '0..*',
				id: { description: 'Patient id', cardinality: '1..1' },
				organization: {
					description: 'Managing org',
					cardinality: '0..1',
					reference: 'organization',
				},
			},
		},
		{
			organization: {
				description: 'Organization source model',
				cardinality: '0..*',
				id: { description: 'Organization id', cardinality: '1..1' },
			},
		},
	]);

	const report = validateDatasetAuthoring({
		schema,
		resources: [
			{
				path: 'dataset/resources/patient/1.json',
				resourceType: 'patient',
				value: {
					organization: 'missing-org',
					extraField: 'unexpected',
				},
			},
		],
		scenarios: [],
		links: [],
		codeMappings: [],
		generatorRuleMappings: [],
	});

	assert.equal(report.errorCount, 3);
	assert.equal(
		report.issues.some((issue) => issue.code === 'resource.missingRequiredField'),
		true,
	);
	assert.equal(
		report.issues.some((issue) => issue.code === 'resource.unknownField'),
		true,
	);
	assert.equal(
		report.issues.some((issue) => issue.code === 'resource.missingReference'),
		true,
	);
});

test('scenario validation reports unsupported keys', () => {
	const issues = validateScenarioDocument({
		id: 'TWCORE-TEST-001',
		name: 'Test',
		type: 'outpatient',
		patient: {
			badKey: 'oops',
		},
	});

	assert.equal(
		issues.some((issue) => issue.code === 'scenario.filter.unsupportedKey'),
		true,
	);
});

test('scenario validation rejects legacy metadata keys', () => {
	const issues = validateScenarioDocument({
		id: 'TWCORE-TEST-002',
		name: 'Test',
		type: 'outpatient',
		displayName: 'Legacy Name',
	});

	assert.equal(
		issues.some((issue) => issue.code === 'scenario.unknownKey' && issue.path === 'displayName'),
		true,
	);
});

test('scenario validation rejects legacy filter alias keys', () => {
	const issues = validateScenarioDocument({
		id: 'TWCORE-TEST-003',
		name: 'Test',
		type: 'outpatient',
		encounter: {
			admissionSource: 'emergency',
		},
		condition: {
			code: 'Cond-001',
		},
	});

	assert.equal(
		issues.some(
			(issue) => issue.code === 'scenario.filter.unsupportedKey' && issue.path === 'encounter.admissionSource',
		),
		true,
	);
	assert.equal(
		issues.some((issue) => issue.code === 'scenario.filter.unsupportedKey' && issue.path === 'condition.code'),
		true,
	);
});

test('scenario validation accepts positive filter limits and rejects invalid limits', () => {
	assert.deepEqual(
		validateScenarioDocument({
			id: 'TWCORE-TEST-004',
			name: 'Test',
			type: 'outpatient',
			observation: {
				observationCode: 'VS-0008',
				limit: 1,
			},
		}),
		[],
	);

	const issues = validateScenarioDocument({
		id: 'TWCORE-TEST-005',
		name: 'Test',
		type: 'outpatient',
		observation: {
			observationCode: 'VS-0008',
			limit: 0,
		},
	});

	assert.equal(
		issues.some((issue) => issue.code === 'scenario.filter.invalidLimit'),
		true,
	);
});

test('scenario schema documents the supported metadata and filter keys', () => {
	const schemaPath = path.resolve(import.meta.dirname, '../../../scenarios/schema.yaml');
	const schema = parse(readFileSync(schemaPath, 'utf8')) as {
		properties: Record<string, { $ref?: string }>;
		$defs: Record<string, { properties?: Record<string, unknown> }>;
	};

	assert.deepEqual(
		Object.keys(schema.properties).sort(),
		[...SCENARIO_CANONICAL_METADATA_KEYS, ...SCENARIO_RESOURCE_KEYS].sort(),
	);

	assert.deepEqual(Object.keys(schema.$defs.selection.properties ?? {}).sort(), [...SCENARIO_SELECTION_KEYS].sort());
	assert.deepEqual(Object.keys(schema.$defs.range.properties ?? {}).sort(), [...SCENARIO_RANGE_KEYS].sort());
	assert.deepEqual(
		Object.keys(schema.$defs.filterObject.properties ?? {}).sort(),
		[...SCENARIO_COMMON_FILTER_KEYS].sort(),
	);
	assert.equal(typeof schema.$defs.filterObject, 'object');
	assert.equal(typeof schema.$defs.resourceSelection, 'object');

	for (const resourceType of SCENARIO_RESOURCE_KEYS) {
		assert.equal(schema.properties[resourceType]?.$ref, '#/$defs/resourceSelection');
	}
});

test('dataset authoring validation reports one orphan warning per mapping key', () => {
	const schema = buildSourceAuthoringSchema([]);

	const report = validateDatasetAuthoring({
		schema,
		resources: [],
		scenarios: [],
		links: [],
		codeMappings: [
			{
				path: 'dataset/converter/code-mappings/identifier-use.csv',
				mappingKey: 'patient.identifierUse',
				sourceCode: 'usual',
				targetCode: 'usual',
				targetSystem: 'http://hl7.org/fhir/identifier-use',
			},
			{
				path: 'dataset/converter/code-mappings/identifier-use.csv',
				mappingKey: 'patient.identifierUse',
				sourceCode: 'official',
				targetCode: 'official',
				targetSystem: 'http://hl7.org/fhir/identifier-use',
			},
		],
		generatorRuleMappings: [],
	});

	assert.equal(report.warningCount, 1);
	assert.equal(report.issues.filter((issue) => issue.code === 'mapping.orphanRow').length, 1);
});

test('dataset authoring validation accepts multi-target links when they match the field contract', () => {
	const schema = buildSourceAuthoringSchema([
		{
			observation: {
				description: 'Observation source model',
				cardinality: '0..*',
				id: { description: 'Observation id', cardinality: '1..1' },
				performerId: {
					description: 'Performer id',
					cardinality: '0..1',
					reference: ['patient', 'practitioner'],
				},
			},
		},
	]);

	const report = validateDatasetAuthoring({
		schema,
		resources: [],
		scenarios: [],
		links: [
			{
				path: '[derived link fixture]',
				sourceType: 'observation',
				field: 'performerId',
				targetTypes: ['patient', 'practitioner'],
			},
		],
		codeMappings: [],
		generatorRuleMappings: [],
	});

	assert.equal(report.errorCount, 0);
	assert.equal(report.warningCount, 0);
});

test('dataset authoring validation derives links from definitions when links input is omitted', () => {
	const schema = buildSourceAuthoringSchema([
		{
			observation: {
				description: 'Observation source model',
				cardinality: '0..*',
				id: { description: 'Observation id', cardinality: '1..1' },
				performerId: {
					description: 'Performer id',
					cardinality: '0..1',
					reference: ['patient', 'practitioner'],
				},
			},
		},
	]);

	const report = validateDatasetAuthoring({
		schema,
		resources: [],
		scenarios: [],
		codeMappings: [],
		generatorRuleMappings: [],
	});

	assert.equal(report.errorCount, 0);
	assert.equal(report.warningCount, 0);
});

test('dataset authoring validation accepts explicit typed references for ambiguous ids', () => {
	const schema = buildSourceAuthoringSchema([
		{
			observation: {
				description: 'Observation source model',
				cardinality: '0..*',
				id: { description: 'Observation id', cardinality: '1..1' },
				performerId: {
					description: 'Performer id',
					cardinality: '0..1',
					reference: ['patient', 'practitioner'],
				},
				performerType: {
					description: 'Performer type',
					cardinality: '0..1',
				},
			},
		},
		{
			patient: {
				description: 'Patient source model',
				cardinality: '0..*',
				id: { description: 'Patient id', cardinality: '1..1' },
			},
		},
		{
			practitioner: {
				description: 'Practitioner source model',
				cardinality: '0..*',
				id: { description: 'Practitioner id', cardinality: '1..1' },
			},
		},
	]);

	const report = validateDatasetAuthoring({
		schema,
		resources: [
			{
				path: 'dataset/resources/patient/shared-1.json',
				resourceType: 'patient',
				value: { id: 'shared-1' },
			},
			{
				path: 'dataset/resources/practitioner/shared-1.json',
				resourceType: 'practitioner',
				value: { id: 'shared-1' },
			},
			{
				path: 'dataset/resources/observation/1.json',
				resourceType: 'observation',
				value: {
					id: '1',
					performerId: 'shared-1',
					performerType: 'practitioner',
				},
			},
		],
		scenarios: [],
		links: [],
		codeMappings: [],
		generatorRuleMappings: [],
	});

	assert.equal(report.errorCount, 0);
	assert.equal(report.warningCount, 0);
});
