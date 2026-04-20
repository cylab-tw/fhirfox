import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { buildGeneratedAssets } from '../build/generated-assets.js';
import { parse } from 'yaml';
import path from 'node:path';
import test from 'node:test';

const SCENARIO_RESOURCE_KEYS = [
	'patient',
	'encounter',
	'condition',
	'allergyIntolerance',
	'observation',
	'procedure',
	'medication',
	'medicationRequest',
	'diagnosticReport',
	'imagingStudy',
] as const;

const EXPECTED_SCENARIO_COUNTS: Record<string, Record<string, number>> = {
	'TWCORE-ER-001': {
		patient: 1,
		encounter: 2,
		organization: 1,
		practitionerrole: 1,
		practitioner: 1,
		condition: 2,
		observation: 2,
		procedure: 2,
	},
	'TWCORE-ER-002': {
		patient: 1,
		encounter: 1,
		organization: 1,
		practitionerrole: 1,
		practitioner: 1,
		observation: 3,
		procedure: 1,
	},
	'TWCORE-ER-003': {
		patient: 1,
		encounter: 1,
		organization: 1,
		practitionerrole: 2,
		practitioner: 2,
		observation: 1,
		procedure: 1,
		diagnosticreport: 1,
		imagingstudy: 1,
		medicationrequest: 1,
		medication: 1,
	},
	'TWCORE-IPD-001': {
		patient: 1,
		encounter: 1,
		organization: 1,
		practitionerrole: 1,
		practitioner: 1,
		condition: 1,
		procedure: 1,
	},
	'TWCORE-IPD-002': {
		patient: 1,
		encounter: 1,
		organization: 1,
		practitionerrole: 1,
		practitioner: 1,
		observation: 5,
	},
	'TWCORE-IPD-003': {
		patient: 1,
		encounter: 1,
		organization: 1,
		practitionerrole: 2,
		practitioner: 2,
		procedure: 2,
		observation: 6,
		diagnosticreport: 2,
		imagingstudy: 1,
		medicationrequest: 3,
		medication: 3,
	},
	'TWCORE-OPD-001': {
		patient: 1,
		encounter: 1,
		organization: 1,
		practitionerrole: 1,
		practitioner: 1,
		condition: 1,
	},
	'TWCORE-OPD-002': {
		patient: 1,
		encounter: 1,
		organization: 1,
		practitionerrole: 1,
		practitioner: 1,
		condition: 1,
		allergyintolerance: 1,
	},
	'TWCORE-OPD-003': {
		patient: 1,
		encounter: 3,
		organization: 1,
		practitionerrole: 1,
		practitioner: 1,
		condition: 3,
	},
	'TWCORE-OPD-004': {
		patient: 1,
		encounter: 1,
		organization: 1,
		practitionerrole: 1,
		practitioner: 1,
		observation: 3,
	},
	'TWCORE-OPD-005': {
		patient: 1,
		encounter: 1,
		organization: 1,
		practitionerrole: 1,
		practitioner: 1,
		observation: 4,
	},
	'TWCORE-OPD-006': {
		patient: 1,
		encounter: 3,
		organization: 1,
		practitionerrole: 1,
		practitioner: 1,
		observation: 4,
	},
	'TWCORE-OPD-007': {
		patient: 1,
		encounter: 1,
		organization: 1,
		practitionerrole: 1,
		practitioner: 1,
		condition: 1,
		observation: 2,
		diagnosticreport: 1,
		medicationrequest: 1,
		medication: 1,
	},
	'TWCORE-OPD-008': {
		patient: 1,
		encounter: 1,
		organization: 1,
		practitionerrole: 2,
		practitioner: 2,
		condition: 1,
		allergyintolerance: 1,
		observation: 3,
		diagnosticreport: 1,
		medicationrequest: 1,
		medication: 1,
	},
	'TWCORE-OPD-009': {
		patient: 1,
		encounter: 3,
		organization: 1,
		practitionerrole: 1,
		practitioner: 1,
		condition: 2,
		observation: 5,
		diagnosticreport: 1,
		medicationrequest: 2,
		medication: 2,
	},
};

test('authored scenarios resolve to explicit fixture counts', async () => {
	const repoRoot = path.resolve(import.meta.dirname, '../../..');
	const assets = await buildGeneratedAssets(path.join(repoRoot, 'dataset'), path.join(repoRoot, 'scenarios'));

	for (const [scenarioId, expectedCounts] of Object.entries(EXPECTED_SCENARIO_COUNTS)) {
		const sourceAsset = assets.assets.get(`/data/scenarios/${encodeURIComponent(scenarioId)}/source.json`);

		assert.ok(sourceAsset, `missing source asset for ${scenarioId}`);

		const sourceResult = JSON.parse(sourceAsset) as {
			resources: Record<string, unknown[]>;
			warnings?: string[];
		};
		const actualCounts = Object.fromEntries(
			Object.entries(sourceResult.resources).map(([resourceType, resources]) => [resourceType, resources.length]),
		);

		assert.deepEqual(actualCounts, expectedCounts, scenarioId);
		assert.equal(sourceResult.warnings, undefined, scenarioId);
	}
});

test('authored scenarios prefer natural filters over exact resource ids', async () => {
	const scenariosRoot = path.resolve(import.meta.dirname, '../../../scenarios');
	const filenames = (await readdir(scenariosRoot))
		.filter((filename) => filename.endsWith('.yaml') && filename !== 'schema.yaml')
		.sort();

	for (const filename of filenames) {
		const document = parse(await readFile(path.join(scenariosRoot, filename), 'utf8')) as Record<string, unknown>;

		for (const resourceKey of SCENARIO_RESOURCE_KEYS) {
			const selection = document[resourceKey];
			const filters = Array.isArray(selection) ? selection : selection ? [selection] : [];

			for (const [index, filter] of filters.entries()) {
				assert.equal(
					isRecord(filter) && 'id' in filter,
					false,
					`${filename} ${resourceKey}[${index}] should use natural filters instead of exact id`,
				);
			}
		}
	}
});

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
