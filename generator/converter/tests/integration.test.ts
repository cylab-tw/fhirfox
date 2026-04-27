import {
	convertResource,
	createStaticConverterService,
	loadStaticConverterRows,
	normalizeRuleSet,
	orderFhirResourceFields,
	orderSourceResourceFields,
	orderSourceResources,
} from '../src/index.js';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import { tmpdir } from 'node:os';

import { type FhirBundle, type FhirResource, type GeneratorRuleRow, type SourceResource } from '../src/index.js';

const fixtureBaseDir = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)), 'dataset', 'converter');

const patient: SourceResource = {
	id: '1',
	resourceType: 'patient',
	idType: 'NNxxx',
	idNumber: 'A123456789',
	name: '王小明',
	gender: 'male',
	birthday: '1985-04-12',
	telecomSystem: 'phone',
	telecomUse: 'mobile',
	telecomValue: '0912-345-678',
	address: '台北市中正區仁愛路一段1號',
	organization: '1',
};

const encounter: SourceResource = {
	id: '1',
	__resourceType: 'encounter',
	type: 'encounter',
	identifier: 'OPD202603300001',
	status: 'finished',
	class: 'AMB',
	serviceType: 'emergency',
	patientId: '1',
	periodStart: '2026-03-30T09:00:00+08:00',
	periodEnd: '2026-03-30T09:20:00+08:00',
	serviceProviderId: '1',
	participantType: 'ATND',
	practitionerId: '1',
	conditionId: '1',
	diagnosisUse: 'AD',
};

const organization: SourceResource = {
	id: '1',
	resourceType: 'organization',
	active: true,
	idType: 'MR',
	idNumber: '1234560018',
	type: 'prov',
	name: '台北範例醫院',
	alias: '範例醫院',
	telecomSystem: 'phone',
	telecomUse: 'work',
	telecomValue: '02-2312-3456',
	address: '台北市中正區常德街1號',
};

const practitioner: SourceResource = {
	id: '1',
	resourceType: 'practitioner',
	active: true,
	idType: 'MR',
	idNumber: 'DOC0001',
	name: '陳醫師',
};

const allergyIntolerance: SourceResource = {
	id: '1',
	resourceType: 'allergyintolerance',
	clinicalStatus: 'active',
	verificationStatus: 'confirmed',
	type: 'allergy',
	category: 'medication',
	criticality: 'high',
	allergyCode: 'Al-M0004',
	patientId: '1',
	encounterId: '1',
	onsetDate: '2024-11-03T08:00:00+08:00',
	recordedDate: '2026-03-30T09:10:00+08:00',
	recorderId: '1',
	note: 'Patient reports rash after penicillin.',
	reactionSubstance: '70618',
	manifestation: '247472004',
	severity: 'severe',
	exposureRoute: '26643006',
};

const condition: SourceResource = {
	id: '1',
	resourceType: 'condition',
	clinicalStatus: 'active',
	verificationStatus: 'confirmed',
	category: 'encounter-diagnosis',
	severity: '255604002',
	conditionCode: 'Cond-016',
	conditionText: '感冒/上呼吸道不適',
	patientId: '1',
	encounterId: '1',
	recordedDate: '2026-03-30T09:05:00+08:00',
	recorderId: '1',
	note: '主訴感冒、流鼻水與喉嚨痛。',
};

const procedure: SourceResource = {
	id: '1',
	resourceType: 'procedure',
	status: 'completed',
	category: '387713003',
	procedureCode: 'Proc-0006',
	procedureText: '頭部傷口縫合',
	patientId: '3',
	encounterId: '6',
	performedDate: '2026-04-18T19:05:00+08:00',
	performerId: '3',
	performerFunction: 'Perf-0007',
	reasonCode: 'Cond-087',
	outcome: '385669000',
};

const observation: SourceResource = {
	id: '3',
	resourceType: 'observation',
	status: 'final',
	categoryCode: 'vital-signs',
	observationCode: 'VS-0013',
	patientId: '3',
	encounterId: '6',
	effectiveDate: '2026-04-18T18:50:00+08:00',
	performerId: '3',
	valueQuantity: '97',
	valueUnit: '%',
};

test('loadStaticConverterRows and normalizeRuleSet index TW Core rows', async () => {
	const rows = await loadStaticConverterRows(fixtureBaseDir, 'tw.gov.mohw.twcore');
	const ruleSet = normalizeRuleSet(rows, 'tw.gov.mohw.twcore', '1.0.0');

	assert.ok(rows.generatorRules.length > 0);
	assert.ok(rows.codeMappings.length > 0);
	assert.ok(rows.resourceProfiles.length > 0);
	assert.ok(ruleSet.generatorRulesByResourceType.has('patient'));
	assert.ok(ruleSet.generatorRulesByResourceType.has('encounter'));
	assert.ok(ruleSet.codeMappingsByKey.has('administrative-gender'));
	assert.ok(ruleSet.resourceProfilesByResourceType.has('patient'));
});

test('toFhirResource converts Patient with copy and code_map rules', async () => {
	const service = createStaticConverterService({
		baseDir: fixtureBaseDir,
	});

	const result = await service.toFhirResource(patient, {
		igName: 'tw.gov.mohw.twcore',
		igVersion: '1.0.0',
	});

	assert.equal(result.resourceType, 'Patient');
	assert.equal(result.id, '1');
	assertValidTwCorePatient(result);
	assert.deepEqual(result.name, [{ use: 'usual', text: '王小明' }]);
	assert.equal(result.gender, 'male');
	assert.equal((result.identifier as Array<{ value?: string }>)?.[0]?.value, 'A123456789');
	assert.equal((result.identifier as Array<{ system?: string }>)?.[0]?.system, 'http://www.moi.gov.tw');
	assert.equal((result.managingOrganization as { reference?: string } | undefined)?.reference, 'Organization/1');
});

test('toFhirResource converts Encounter with copy, code_map, and build_reference rules', async () => {
	const service = createStaticConverterService({
		baseDir: fixtureBaseDir,
	});

	const result = await service.toFhirResource(encounter, {
		igName: 'tw.gov.mohw.twcore',
		igVersion: '1.0.0',
	});

	assert.equal(result.resourceType, 'Encounter');
	assert.equal(result.id, '1');
	assertValidTwCoreEncounter(result);
	assert.equal(result.status, 'finished');
	assert.deepEqual(result.class, {
		code: 'AMB',
		display: 'ambulatory',
		system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
	});
	assert.equal(
		(result.identifier as Array<{ system?: string }> | undefined)?.[0]?.system,
		'https://fhirfox.dev/identifier-system/encounter',
	);
	assert.equal((result.subject as { reference?: string } | undefined)?.reference, 'Patient/1');
	assert.equal((result.serviceProvider as { reference?: string } | undefined)?.reference, 'Organization/1');
	assert.equal(
		(result.serviceType as { coding?: Array<{ system?: string }> } | undefined)?.coding?.[0]?.system,
		'http://terminology.hl7.org/CodeSystem/service-type',
	);
	assert.equal(
		(result.participant as Array<{ type?: Array<{ coding?: Array<{ system?: string }> }> }> | undefined)?.[0]?.type?.[0]
			?.coding?.[0]?.system,
		'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
	);
});

test('toFhirResource uses explicit reference types for polymorphic references', async () => {
	const service = createStaticConverterService({
		baseDir: fixtureBaseDir,
	});

	const result = await service.toFhirResource(
		{
			...observation,
			performerId: '3',
			performerType: 'organization',
		},
		{
			igName: 'tw.gov.mohw.twcore',
			igVersion: '1.0.0',
		},
	);

	assert.equal(((result.performer as Array<{ reference?: string }>)?.[0] ?? {}).reference, 'Organization/3');
});

test('toFhirBundle preserves input order and builds urn:uuid fullUrl values', async () => {
	const service = createStaticConverterService({
		baseDir: fixtureBaseDir,
	});

	const result = await service.toFhirBundle([patient, encounter, organization, practitioner, condition], {
		igName: 'tw.gov.mohw.twcore',
		igVersion: '1.0.0',
		fullUrlBase: 'https://example.test/fhir',
	});

	assert.equal(result.resourceType, 'Bundle');
	assert.equal(result.type, 'collection');
	assert.equal(result.entry.length, 5);
	assert.equal(result.entry[0]?.resource.resourceType, 'Patient');
	assert.equal(result.entry[1]?.resource.resourceType, 'Encounter');
	assert.match(
		result.entry[0]?.fullUrl ?? '',
		/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
	);
	assert.match(
		result.entry[1]?.fullUrl ?? '',
		/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
	);
	assert.equal(
		(result.entry[1]?.resource.subject as { reference?: string } | undefined)?.reference,
		result.entry[0]?.fullUrl,
	);
	assertBundleReferencesResolveToFullUrls(result);
	assertValidTwCoreBundle(result);
});

test('toFhirBundle builds stable urn:uuid fullUrl values when no base is configured', async () => {
	const service = createStaticConverterService({
		baseDir: fixtureBaseDir,
	});

	const result = await service.toFhirBundle([patient, encounter, organization, practitioner, condition], {
		igName: 'tw.gov.mohw.twcore',
		igVersion: '1.0.0',
	});

	assert.equal(result.entry[0]?.fullUrl, 'urn:uuid:9856207c-fa65-5c44-a20e-b663ce8a5898');
	assert.equal(result.entry[1]?.fullUrl, 'urn:uuid:f79ff2d8-f1f8-547b-a55e-235b05ad3158');
	assert.equal(
		(result.entry[1]?.resource.subject as { reference?: string } | undefined)?.reference,
		result.entry[0]?.fullUrl,
	);
	assertBundleReferencesResolveToFullUrls(result);
});

test('toFhirResource maps observation quantity display into unit instead of invalid display', async () => {
	const service = createStaticConverterService({
		baseDir: fixtureBaseDir,
	});

	const result = await service.toFhirResource(observation, {
		igName: 'tw.gov.mohw.twcore',
		igVersion: '1.0.0',
	});

	assert.deepEqual(result.valueQuantity, {
		value: '97',
		code: '%',
		unit: 'percent',
		system: 'http://unitsofmeasure.org',
	});
	assert.equal((result.valueQuantity as { display?: string } | undefined)?.display, undefined);
	assertValidTwCoreProfile(
		result,
		'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Observation-vitalSigns-twcore',
	);
});

test('toFhirResource applies missing TW Core profiles for condition and procedure resources', async () => {
	const service = createStaticConverterService({
		baseDir: fixtureBaseDir,
	});

	const conditionResult = await service.toFhirResource(condition, {
		igName: 'tw.gov.mohw.twcore',
		igVersion: '1.0.0',
	});
	const procedureResult = await service.toFhirResource(procedure, {
		igName: 'tw.gov.mohw.twcore',
		igVersion: '1.0.0',
	});

	assertValidTwCoreProfile(
		conditionResult,
		'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Condition-twcore',
	);
	assertValidTwCoreProfile(
		procedureResult,
		'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Procedure-twcore',
	);
});

test('canonical source ordering places all encounters together before shared encounter-linked resources', async () => {
	const ordered = orderSourceResources([
		condition,
		{
			id: '2',
			resourceType: 'encounter',
			identifier: 'OPD202604120031',
			status: 'finished',
			class: 'AMB',
			patientId: '1',
			periodStart: '2026-04-12T15:00:00+08:00',
			periodEnd: '2026-04-12T15:25:00+08:00',
			serviceProviderId: '1',
			participantType: 'ATND',
			practitionerId: '1',
			conditionId: '3',
			diagnosisUse: 'AD',
		},
		{
			id: '3',
			resourceType: 'condition',
			clinicalStatus: 'active',
			verificationStatus: 'confirmed',
			category: 'encounter-diagnosis',
			severity: '6736007',
			conditionCode: 'Cond-065',
			conditionText: '胸悶/胸部不適',
			patientId: '1',
			encounterId: '2',
			recordedDate: '2026-04-12T15:12:00+08:00',
			recorderId: '1',
		},
		{
			id: '1',
			resourceType: 'practitionerrole',
			active: true,
			practitionerId: '1',
			organizationId: '1',
			roleCode: 'PR-0003',
			specialtyCode: 'Spec-0001',
			periodStart: '2024-01-01T08:00:00+08:00',
		},
		organization,
		encounter,
		{
			id: '1',
			resourceType: 'practitioner',
			active: true,
			idType: 'MR',
			idNumber: 'DOC0001',
			name: '陳醫師',
		},
		patient,
		allergyIntolerance,
	]);

	assert.deepEqual(
		ordered.orderedResources.map((resource) => `${resource.resourceType ?? resource.type}/${resource.id}`),
		[
			'patient/1',
			'encounter/1',
			'encounter/2',
			'organization/1',
			'practitionerrole/1',
			'practitioner/1',
			'condition/1',
			'condition/3',
			'allergyintolerance/1',
		],
	);
	assert.deepEqual(Object.keys(ordered.groupedResources), [
		'patient',
		'encounter',
		'organization',
		'practitionerrole',
		'practitioner',
		'condition',
		'allergyintolerance',
	]);
});

test('canonical field ordering aligns source and FHIR fields to local metadata', async () => {
	const rows = await loadStaticConverterRows(fixtureBaseDir, 'tw.gov.mohw.twcore');
	const ruleSet = normalizeRuleSet(rows, 'tw.gov.mohw.twcore', '1.0.0');
	ruleSet.sourceFieldOrder = {
		patient: [
			'resourceType',
			'id',
			'idType',
			'idNumber',
			'active',
			'name',
			'telecomSystem',
			'telecomValue',
			'telecomUse',
			'gender',
			'birthday',
			'address',
			'organization',
		],
	};
	const orderedSource = orderSourceResourceFields(
		{
			id: '1',
			resourceType: 'patient',
			name: '王小明',
			organization: '1',
			idNumber: 'A123456789',
			gender: 'male',
			idType: 'NNxxx',
		},
		ruleSet,
	);
	const orderedFhir = orderFhirResourceFields(
		convertResource(patient, ruleSet, {
			igName: 'tw.gov.mohw.twcore',
			igVersion: '1.0.0',
		}),
		'patient',
		ruleSet,
	);

	assert.deepEqual(Object.keys(orderedSource).slice(0, 6), [
		'resourceType',
		'id',
		'idType',
		'idNumber',
		'name',
		'gender',
	]);
	assert.deepEqual(Object.keys(orderedFhir).slice(0, 6), ['resourceType', 'id', 'meta', 'text', 'identifier', 'name']);
	assert.deepEqual(Object.keys((orderedFhir.identifier as Array<Record<string, unknown>>)[0] ?? {}), [
		'type',
		'value',
		'system',
	]);
	assert.deepEqual(
		Object.keys(
			((
				(orderedFhir.identifier as Array<Record<string, unknown>>)[0]?.type as {
					coding?: Array<Record<string, unknown>>;
				}
			)?.coding?.[0] ?? {}) as Record<string, unknown>,
		),
		['system', 'code', 'display'],
	);
});

test('encounter field ordering follows explicit TW Core example-driven order', async () => {
	const rows = await loadStaticConverterRows(fixtureBaseDir, 'tw.gov.mohw.twcore');
	const ruleSet = normalizeRuleSet(rows, 'tw.gov.mohw.twcore', '1.0.0');
	ruleSet.sourceFieldOrder = {
		encounter: [
			'resourceType',
			'id',
			'identifier',
			'status',
			'class',
			'type',
			'serviceType',
			'patientId',
			'participantType',
			'practitionerId',
			'periodStart',
			'periodEnd',
			'conditionId',
			'diagnosisUse',
			'admitSource',
			'dischargeDisposition',
			'locationId',
			'serviceProviderId',
		],
	};
	const orderedSource = orderSourceResourceFields(
		{
			id: '5',
			__resourceType: 'encounter',
			resourceType: 'encounter',
			serviceProviderId: '1',
			periodEnd: '2026-04-06T23:45:00+08:00',
			patientId: '3',
			participantType: 'ATND',
			identifier: 'ER202604060001',
			status: 'finished',
			periodStart: '2026-04-06T22:10:00+08:00',
			practitionerId: '3',
			serviceType: 'emergency',
			class: 'EMER',
			conditionId: '5',
			diagnosisUse: 'AD',
			admitSource: 'emd',
		},
		ruleSet,
	);
	const orderedFhir = orderFhirResourceFields(
		convertResource(
			{
				...encounter,
				serviceType: 'emergency',
				admitSource: 'emd',
			},
			ruleSet,
			{
				igName: 'tw.gov.mohw.twcore',
				igVersion: '1.0.0',
			},
		),
		'encounter',
		ruleSet,
	);

	assert.deepEqual(Object.keys(orderedSource), [
		'resourceType',
		'id',
		'identifier',
		'status',
		'class',
		'serviceType',
		'patientId',
		'participantType',
		'practitionerId',
		'periodStart',
		'periodEnd',
		'conditionId',
		'diagnosisUse',
		'admitSource',
		'serviceProviderId',
	]);
	assert.deepEqual(Object.keys(orderedFhir).slice(0, 13), [
		'resourceType',
		'id',
		'meta',
		'text',
		'identifier',
		'status',
		'class',
		'serviceType',
		'subject',
		'participant',
		'period',
		'diagnosis',
		'hospitalization',
	]);
});

test('toFhirResource converts Organization with mapped codings and primitive arrays', async () => {
	const service = createStaticConverterService({
		baseDir: fixtureBaseDir,
	});

	const result = await service.toFhirResource(organization, {
		igName: 'tw.gov.mohw.twcore',
		igVersion: '1.0.0',
	});

	assert.equal(result.resourceType, 'Organization');
	assertValidTwCoreOrganization(result);
	assert.deepEqual(result.alias, ['範例醫院']);
	assert.equal((result.type as Array<{ coding?: Array<{ code?: string }> }>)?.[0]?.coding?.[0]?.code, 'prov');
});

test('toFhirResource converts AllergyIntolerance with mapped coding and reaction content', async () => {
	const service = createStaticConverterService({
		baseDir: fixtureBaseDir,
	});

	const result = await service.toFhirResource(allergyIntolerance, {
		igName: 'tw.gov.mohw.twcore',
		igVersion: '1.0.0',
	});

	assert.equal(result.resourceType, 'AllergyIntolerance');
	assertValidTwCoreAllergyIntolerance(result);
	assert.deepEqual(result.category, ['medication']);
	assert.equal((result.code as { coding?: Array<{ code?: string }> } | undefined)?.coding?.[0]?.code, '91936005');
	assert.equal((result.patient as { reference?: string } | undefined)?.reference, 'Patient/1');
	assert.equal(
		(result.reaction as Array<{ manifestation?: Array<{ coding?: Array<{ system?: string }> }> }> | undefined)?.[0]
			?.manifestation?.[0]?.coding?.[0]?.system,
		'http://snomed.info/sct',
	);
});

test('toFhirResource converts Condition with mapped local condition code', async () => {
	const service = createStaticConverterService({
		baseDir: fixtureBaseDir,
	});

	const result = await service.toFhirResource(condition, {
		igName: 'tw.gov.mohw.twcore',
		igVersion: '1.0.0',
	});

	assert.equal(result.resourceType, 'Condition');
	assert.equal((result.code as { coding?: Array<{ code?: string }> } | undefined)?.coding?.[0]?.code, '233604007');
	assert.equal((result.subject as { reference?: string } | undefined)?.reference, 'Patient/1');
	assert.equal((result.recorder as { reference?: string } | undefined)?.reference, 'Practitioner/1');
});

test('toFhirResource converts Procedure with mapped code, performer function, and reason', async () => {
	const service = createStaticConverterService({
		baseDir: fixtureBaseDir,
	});

	const result = await service.toFhirResource(procedure, {
		igName: 'tw.gov.mohw.twcore',
		igVersion: '1.0.0',
	});

	assert.equal(result.resourceType, 'Procedure');
	assert.equal((result.code as { coding?: Array<{ code?: string }> } | undefined)?.coding?.[0]?.code, '449814002');
	assert.equal(
		(result.performer as Array<{ function?: { coding?: Array<{ code?: string }> } }>)?.[0]?.function?.coding?.[0]?.code,
		'309294001',
	);
	assert.equal((result.reasonCode as Array<{ coding?: Array<{ code?: string }> }>)?.[0]?.coding?.[0]?.code, '82271004');
});

test('conversion fails explicitly when no rules exist for the source resource type', async () => {
	const service = createStaticConverterService({
		baseDir: fixtureBaseDir,
	});

	await assert.rejects(
		service.toFhirResource(
			{
				id: 'x',
				resourceType: 'location',
				name: '未對應地點',
			},
			{
				igName: 'tw.gov.mohw.twcore',
				igVersion: '1.0.0',
			},
		),
		/No converter rules found/,
	);
});

test('conversion fails explicitly when a required source value is missing', async () => {
	const service = createStaticConverterService({
		baseDir: fixtureBaseDir,
	});

	await assert.rejects(
		service.toFhirResource(
			{
				...patient,
				gender: '',
			},
			{
				igName: 'tw.gov.mohw.twcore',
				igVersion: '1.0.0',
			},
		),
		/Missing required source value "gender"/,
	);
});

test('conversion fails explicitly when a code mapping is missing', async () => {
	const service = createStaticConverterService({
		baseDir: fixtureBaseDir,
	});

	await assert.rejects(
		service.toFhirResource(
			{
				...patient,
				gender: 'nonexistent',
			},
			{
				igName: 'tw.gov.mohw.twcore',
				igVersion: '1.0.0',
			},
		),
		/Missing code mapping/,
	);
});

test('convertResource fails explicitly on unsupported transform kind', async () => {
	const rows = await loadStaticConverterRows(fixtureBaseDir, 'tw.gov.mohw.twcore');
	const badRule = {
		...rows.generatorRules[0],
		transformKind: 'unsupported',
	} as unknown as GeneratorRuleRow;
	const ruleSet = normalizeRuleSet(
		{
			...rows,
			generatorRules: [badRule],
		},
		'tw.gov.mohw.twcore',
		'1.0.0',
	);

	assert.throws(
		() =>
			convertResource(patient, ruleSet, {
				igName: 'tw.gov.mohw.twcore',
				igVersion: '1.0.0',
			}),
		/Unsupported transform kind/,
	);
});

test('convertResource fails explicitly on unsupported FHIR path shape', async () => {
	const rows = await loadStaticConverterRows(fixtureBaseDir, 'tw.gov.mohw.twcore');
	const badRule: GeneratorRuleRow = {
		igName: 'tw.gov.mohw.twcore',
		igVersion: '1.0.0',
		resourceType: 'patient',
		sourceColumn: 'name',
		fhirPath: "Patient.name.where(use='usual').text",
		dataType: 'string',
		isRequired: true,
		transformKind: 'copy',
		sortOrder: 1,
		isActive: true,
	};
	const ruleSet = normalizeRuleSet(
		{
			...rows,
			generatorRules: [badRule],
		},
		'tw.gov.mohw.twcore',
		'1.0.0',
	);

	assert.throws(
		() =>
			convertResource(patient, ruleSet, {
				igName: 'tw.gov.mohw.twcore',
				igVersion: '1.0.0',
			}),
		/Unsupported FHIR path segment/,
	);
});

test('static service can load rules from a temp fixture directory', async () => {
	const baseDir = await mkdtemp(path.join(tmpdir(), 'fhirfox-converter-'));

	try {
		await writeFixtureFiles(baseDir);

		const service = createStaticConverterService({ baseDir });
		const result = await service.toFhirResource(patient, {
			igName: 'tw.gov.mohw.twcore',
			igVersion: '1.0.0',
		});

		assert.equal(result.resourceType, 'Patient');
		assertValidTwCoreProfile(result, 'https://twcore.example/Patient');
		assert.equal(result.gender, 'male');
	} finally {
		await rm(baseDir, { recursive: true, force: true });
	}
});

function assertValidTwCoreBundle(bundle: FhirBundle): void {
	assert.equal(bundle.resourceType, 'Bundle');
	assert.equal(bundle.type, 'collection');
	assert.ok(Array.isArray(bundle.entry));

	for (const entry of bundle.entry) {
		assert.ok(entry.resource);

		if (entry.resource.resourceType === 'Patient') {
			assertValidTwCorePatient(entry.resource);
		}

		if (entry.resource.resourceType === 'Encounter') {
			assertValidTwCoreEncounter(entry.resource);
		}
	}
}

function assertBundleReferencesResolveToFullUrls(bundle: FhirBundle): void {
	const fullUrls = new Set(
		bundle.entry.map((entry) => entry.fullUrl).filter((fullUrl): fullUrl is string => Boolean(fullUrl)),
	);

	for (const [index, entry] of bundle.entry.entries()) {
		assert.equal(typeof entry.fullUrl, 'string', `Bundle.entry[${index}] is missing fullUrl.`);
	}

	for (const reference of collectReferences(bundle)) {
		if (reference.startsWith('#')) {
			continue;
		}

		assert.ok(fullUrls.has(reference), `Reference "${reference}" does not match any Bundle.entry.fullUrl.`);
	}
}

function collectReferences(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.flatMap((entry) => collectReferences(entry));
	}

	if (typeof value !== 'object' || value === null) {
		return [];
	}

	return Object.entries(value).flatMap(([key, entryValue]) => {
		const nestedReferences = collectReferences(entryValue);

		if (key === 'reference' && typeof entryValue === 'string') {
			return [entryValue, ...nestedReferences];
		}

		return nestedReferences;
	});
}

function assertValidTwCoreAllergyIntolerance(resource: FhirResource): void {
	assert.equal(resource.resourceType, 'AllergyIntolerance');
	assertValidTwCoreProfile(
		resource,
		'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/AllergyIntolerance-twcore',
	);
	assert.equal(typeof resource.id, 'string');
	assert.equal(
		typeof (resource.clinicalStatus as { coding?: Array<{ code?: string }> } | undefined)?.coding?.[0]?.code,
		'string',
	);
	assert.ok(Array.isArray(resource.category));
	assert.equal(typeof (resource.patient as { reference?: string } | undefined)?.reference, 'string');
}

function assertValidTwCorePatient(resource: FhirResource): void {
	assert.equal(resource.resourceType, 'Patient');
	assertValidTwCoreProfile(resource, 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Patient-twcore');
	assert.equal(typeof resource.id, 'string');
	assert.ok(Array.isArray(resource.identifier));
	assert.equal(
		(resource.identifier as Array<{ type?: { coding?: Array<{ code?: string }> } }>)?.[0]?.type?.coding?.[0]?.code,
		'NNxxx',
	);
	assert.equal(typeof (resource.name as Array<{ text?: string }>)?.[0]?.text, 'string');
	assert.equal(typeof resource.gender, 'string');
	assert.equal(typeof resource.birthDate, 'string');
}

function assertValidTwCoreEncounter(resource: FhirResource): void {
	assert.equal(resource.resourceType, 'Encounter');
	assertValidTwCoreProfile(resource, 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Encounter-twcore');
	assert.equal(typeof resource.id, 'string');
	assert.equal(typeof resource.status, 'string');
	assert.equal(typeof (resource.class as { code?: string } | undefined)?.code, 'string');
	assert.equal(typeof (resource.subject as { reference?: string } | undefined)?.reference, 'string');
	assert.equal(typeof (resource.period as { start?: string } | undefined)?.start, 'string');
}

function assertValidTwCoreOrganization(resource: FhirResource): void {
	assert.equal(resource.resourceType, 'Organization');
	assertValidTwCoreProfile(resource, 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Organization-twcore');
	assert.equal(typeof resource.id, 'string');
	assert.ok(Array.isArray(resource.identifier));
	assert.ok(Array.isArray(resource.type));
	assert.equal(typeof resource.name, 'string');
	assert.ok(Array.isArray(resource.alias));
}

function assertValidTwCoreProfile(resource: FhirResource, profileUrl: string): void {
	assert.deepEqual(resource.meta?.profile, [profileUrl]);
}

async function writeFixtureFiles(baseDir: string): Promise<void> {
	await mkdir(path.join(baseDir, 'generator-rules'), { recursive: true });
	await mkdir(path.join(baseDir, 'code-mappings'), { recursive: true });

	await writeFile(
		path.join(baseDir, 'resource-profiles.csv'),
		[
			'ig_name,ig_version,resource_type,profile_url,is_active',
			'tw.gov.mohw.twcore,1.0.0,patient,https://twcore.example/Patient,true',
		].join('\n'),
		'utf8',
	);
	await writeFile(
		path.join(baseDir, 'generator-rules', 'tw.gov.mohw.twcore.csv'),
		[
			'ig_name,ig_version,resource_type,source_column,fhir_path,data_type,is_required,transform_kind,mapping_key,reference_target,sort_order,is_active',
			'tw.gov.mohw.twcore,1.0.0,patient,name,Patient.name[0]:usual.text,string,true,copy,,,10,true',
			'tw.gov.mohw.twcore,1.0.0,patient,gender,Patient.gender,string,true,code_map,administrative-gender,,20,true',
		].join('\n'),
		'utf8',
	);
	await writeFile(
		path.join(baseDir, 'code-mappings', 'administrative-gender.csv'),
		[
			'source_code,target_code,target_display,target_system,display_zh_tw,is_active',
			'male,male,Male,http://hl7.org/fhir/administrative-gender,,true',
		].join('\n'),
		'utf8',
	);
}
