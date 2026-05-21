import assert from 'node:assert/strict';
import test from 'node:test';

import { createGraph, orderGraphKeys } from '#/resolution/graph.js';

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

test('createGraph builds a hierarchical tree for typical FHIR resources', () => {
	const nodes = [
		{ key: 'Patient/p1', alias: 'p1', resourceType: 'Patient', origin: 'explicit' as const, materialization: 'generated' as const, with: [] },
		{ key: 'Organization/o1', alias: 'o1', resourceType: 'Organization', origin: 'explicit' as const, materialization: 'generated' as const, with: [] },
		{ key: 'Encounter/e1', alias: 'e1', resourceType: 'Encounter', origin: 'explicit' as const, materialization: 'generated' as const, with: [] },
		{ key: 'Observation/obs1', alias: 'obs1', resourceType: 'Observation', origin: 'explicit' as const, materialization: 'generated' as const, with: [] },
	];

	const edges = [
		{ from: 'Patient/p1', to: 'Organization/o1', field: 'managingOrganizationId', relation: 'reference' as const },
		{ from: 'Encounter/e1', to: 'Patient/p1', field: 'patientId', relation: 'reference' as const },
		{ from: 'Observation/obs1', to: 'Encounter/e1', field: 'encounterId', relation: 'reference' as const },
	];

	const graph = createGraph(nodes, edges);

	assert.equal(graph.tree.length, 1);
	assert.equal(graph.tree[0].resourceType, 'Patient');
	assert.equal(graph.tree[0].children.length, 2);
	
	const org = graph.tree[0].children.find(c => c.resourceType === 'Organization');
	const enc = graph.tree[0].children.find(c => c.resourceType === 'Encounter');
	
	assert.ok(org);
	assert.ok(enc);
	assert.equal(enc.children.length, 1);
	assert.equal(enc.children[0].resourceType, 'Observation');
});
