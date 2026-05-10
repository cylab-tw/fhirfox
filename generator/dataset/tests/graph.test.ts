import assert from 'node:assert/strict';
import test from 'node:test';

import { orderGraphKeys } from '#/resolution/graph.js';

test('orderGraphKeys walks relation graph depth-first using scenario order for siblings', () => {
	const nodes = ['a', 'b', 'f', 'c', 'd', 'e', 'g'].map((key) => ({
		key,
		alias: key,
		resourceType: 'test',
		origin: 'explicit' as const,
		materialization: 'generated' as const,
		with: [],
	}));
	const edge = (from: string, to: string) => ({
		from,
		to,
		field: 'parent',
		relation: 'reference' as const,
	});

	assert.deepEqual(
		orderGraphKeys(nodes, [
			edge('a', 'b'),
			edge('b', 'c'),
			edge('b', 'd'),
			edge('b', 'e'),
			edge('a', 'f'),
			edge('f', 'g'),
		]),
		['a', 'b', 'c', 'd', 'e', 'f', 'g'],
	);
});

test('orderGraphKeys keeps requiring resources above their supports', () => {
	const nodes = ['organization', 'patient', 'medicationrequest', 'medication'].map((key) => ({
		key,
		alias: key,
		resourceType: 'test',
		origin: 'explicit' as const,
		materialization: 'generated' as const,
		with: [],
	}));

	assert.deepEqual(
		orderGraphKeys(nodes, [
			{ from: 'patient', to: 'organization', field: 'organization', relation: 'reference' },
			{ from: 'medicationrequest', to: 'medication', field: 'medicationId', relation: 'requires' },
		]),
		['organization', 'patient', 'medicationrequest', 'medication'],
	);
});

test('orderGraphKeys keeps cyclic graph traversal deterministic', () => {
	const nodes = ['a', 'b', 'c'].map((key) => ({
		key,
		alias: key,
		resourceType: 'test',
		origin: 'explicit' as const,
		materialization: 'generated' as const,
		with: [],
	}));

	assert.deepEqual(
		orderGraphKeys(nodes, [
			{ from: 'a', to: 'b', field: 'next', relation: 'reference' },
			{ from: 'b', to: 'a', field: 'previous', relation: 'reference' },
		]),
		['a', 'b', 'c'],
	);
});
