/* eslint-disable sort-imports */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createSeededRandom, randomFor } from '#/generators/random.js';
import { birthDateGenerator } from '#/generators/builtins/birth-date.js';
import { caseGenerator } from '#/generators/builtins/case.js';
import { caseNumberGenerator } from '#/generators/builtins/case-number.js';
import { humanNameGenerator } from '#/generators/builtins/human-name.js';
import { inputGenerator } from '#/generators/builtins/input.js';
import { numberGenerator } from '#/generators/builtins/number.js';
import { taiwanAddressGenerator } from '#/generators/builtins/taiwan-address.js';
import { taiwanMobilePhoneGenerator } from '#/generators/builtins/taiwan-mobile-phone.js';
import { taiwanNationalIdGenerator } from '#/generators/builtins/taiwan-national-id.js';
import type { GeneratorContext } from '#/generators/types.js';
import { createResolutionContext } from '#/resolution/context.js';
import { materializeResource } from '#/resolution/materialize.js';

function context(overrides: Partial<GeneratorContext> = {}): GeneratorContext {
	return {
		seed: 'test-seed',
		now: new Date('2026-05-07T00:00:00.000Z'),
		resourceType: 'patient',
		alias: 'patient-1',
		inputs: {},
		values: {},
		nextId: (resourceType) => `${resourceType}-1`,
		random: createSeededRandom('test-seed'),
		ref: () => undefined,
		bindingRef: () => undefined,
		...overrides,
	};
}

function ageOn(date: unknown, now: Date): number {
	assert.equal(typeof date, 'string');

	const birthDate = new Date(`${date}T00:00:00.000Z`);
	let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
	const birthdayThisYear = Date.UTC(now.getUTCFullYear(), birthDate.getUTCMonth(), birthDate.getUTCDate());
	if (now.getTime() < birthdayThisYear) {
		age -= 1;
	}
	return age;
}

test('randomFor scopes random values by resource alias and field', () => {
	const base = context();

	assert.equal(randomFor(base, 'component'), randomFor(base, 'component'));
	assert.notEqual(randomFor(base, 'component'), randomFor(context({ alias: 'patient-2' }), 'component'));
	assert.notEqual(randomFor(base, 'component'), randomFor(context({ field: 'other' }), 'component'));
});

test('seed changes generated output', () => {
	const a = context({ seed: 'seed-a', random: createSeededRandom('seed-a') });
	const b = context({ seed: 'seed-b', random: createSeededRandom('seed-b') });

	assert.notEqual(taiwanAddressGenerator([], a), taiwanAddressGenerator([], b));
	assert.notEqual(taiwanMobilePhoneGenerator([], a), taiwanMobilePhoneGenerator([], b));
	assert.notEqual(taiwanNationalIdGenerator([], a), taiwanNationalIdGenerator([], b));
});

test('numberGenerator samples integer bounds without rounding bias', () => {
	const low = numberGenerator([{ gte: 0, lte: 4 }], context({ seed: 'seed-b', random: createSeededRandom('seed-b') }));
	const high = numberGenerator(
		[{ gte: 0, lte: 4 }],
		context({ seed: 'test-seed', random: createSeededRandom('test-seed') }),
	);

	assert.equal(low, 1);
	assert.equal(high, 4);
	assert.notEqual(low, high);
});

test('numberGenerator supports decimal bounds for clinical values', () => {
	const value = numberGenerator(
		[{ gte: 0.01, lte: 0.04, decimals: 2 }],
		context({ seed: 'test-seed', random: createSeededRandom('test-seed') }),
	);

	assert.equal(value, 0.04);
});

test('inputGenerator reads field-scoped scenario input', () => {
	const value = inputGenerator([], context({ field: 'code', inputs: { code: 'Lab-0001' } }));

	assert.equal(value, 'Lab-0001');
});

test('caseGenerator maps an input profile to the current field', () => {
	const value = caseGenerator(
		[
			{
				source: 'code',
				cases: {
					'Lab-0001': { display: 'CBC' },
				},
			},
		],
		context({ field: 'display', inputs: { code: 'Lab-0001' } }),
	);

	assert.equal(value, 'CBC');
});

test('caseNumberGenerator samples nested generator bounds from a profile case', () => {
	const value = caseNumberGenerator(
		[
			{
				source: 'code',
				cases: {
					'Lab-0001': {
						valueQuantity: {
							generator: '$number()',
							input: { gte: 1.1, lte: 1.3, decimals: 1 },
						},
					},
				},
			},
		],
		context({ field: 'valueQuantity', inputs: { code: 'Lab-0001' } }),
	);

	assert.equal(value, 1.2);
});

test('birthDateGenerator returns a real birthday for the requested age', () => {
	const a = birthDateGenerator([30], context({ seed: 'seed-a', random: createSeededRandom('seed-a') }));
	const b = birthDateGenerator([30], context({ seed: 'seed-b', random: createSeededRandom('seed-b') }));

	assert.equal(a, '1996-04-12');
	assert.equal(b, '1996-02-06');
	assert.notEqual(a, b);
});

test('birthDateGenerator supports age bounds from scenario inputs', () => {
	const now = new Date('2026-05-07T00:00:00.000Z');
	const adult = birthDateGenerator([{ gt: 18, lte: 64 }], context({ now }));
	const child = birthDateGenerator([{ gte: 0, lt: 12 }], context({ now, alias: 'patient-child' }));

	assert.ok(ageOn(adult, now) > 18);
	assert.ok(ageOn(adult, now) <= 64);
	assert.ok(ageOn(child, now) >= 0);
	assert.ok(ageOn(child, now) < 12);
});

test('composed Taiwan generators vary across aliases', () => {
	const aliases = Array.from({ length: 200 }, (_, index) => `patient-${index}`);
	const addresses = new Set(aliases.map((alias) => taiwanAddressGenerator([], context({ alias }))));
	const phones = new Set(aliases.map((alias) => taiwanMobilePhoneGenerator([], context({ alias }))));
	const nationalIds = new Set(aliases.map((alias) => taiwanNationalIdGenerator([], context({ alias }))));
	const names = new Set(aliases.map((alias) => humanNameGenerator([], context({ alias }))));

	assert.ok(addresses.size > 180);
	assert.ok(phones.size > 190);
	assert.ok(nationalIds.size > 190);
	assert.ok(names.size > 80);
});

test('literal field defaults stay literal during materialization', () => {
	const result = materializeResource({
		resource: {
			alias: 'patient-1',
			resourceType: 'patient',
			inputs: {},
		},
		definition: {
			resourceType: 'patient',
			name: 'Patient',
			fields: [
				{
					id: 'displayName',
					name: 'Display Name',
					type: 'string',
					path: 'patient.displayName',
					required: true,
					default: 'Alice',
				},
				{
					id: 'sequence',
					name: 'Sequence',
					type: 'string',
					path: 'patient.sequence',
					required: true,
					default: '$id("patient")',
				},
			],
		},
		presets: [],
		context: createResolutionContext({ seed: 'seed-a' }),
		ref: () => undefined,
		bindingRef: () => undefined,
	});

	assert.equal(result.resource.displayName, 'Alice');
	assert.equal(result.resource.sequence, '1');
});

test('encounter identifier defaults derive from the generated id', () => {
	const result = materializeResource({
		resource: {
			alias: 'encounter-1',
			resourceType: 'encounter',
			inputs: {},
		},
		definition: {
			resourceType: 'encounter',
			name: 'Encounter',
			fields: [
				{
					id: 'id',
					name: 'Id',
					type: 'string',
					path: 'Encounter.id',
					required: true,
					default: '$id("encounter")',
				},
				{
					id: 'idSystem',
					name: 'Identifier System',
					type: 'string',
					path: 'Encounter.identifier.system',
					required: false,
					default: 'https://fhirfox.dev/identifier-system/encounter',
				},
				{
					id: 'identifier',
					name: 'Identifier',
					type: 'string',
					path: 'Encounter.identifier',
					required: false,
					default: '$concat("ENC-", $value("id"))',
				},
			],
		},
		presets: [],
		context: createResolutionContext({ seed: 'seed-a' }),
		ref: () => undefined,
		bindingRef: () => undefined,
	});

	assert.equal(result.resource.id, '1');
	assert.equal(result.resource.idSystem, 'https://fhirfox.dev/identifier-system/encounter');
	assert.equal(result.resource.identifier, 'ENC-1');
});
