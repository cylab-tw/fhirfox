import assert from 'node:assert/strict';
import { buildGeneratedAssets } from '../build/generated-assets.js';
import path from 'node:path';
import test from 'node:test';

const EXPECTED_SCENARIO_COUNTS: Record<string, Record<string, number>> = {
	'IPS_TWCORE-MIX-001': {
		patient: 1,
		encounter: 5,
		organization: 1,
		practitionerrole: 3,
		practitioner: 3,
		condition: 2,
		observation: 2,
		diagnosticreport: 2,
		medicationrequest: 12,
		medication: 4,
	},
	'IPS_TWCORE-MIX-002': {
		patient: 1,
		encounter: 8,
		organization: 1,
		practitionerrole: 4,
		practitioner: 4,
		condition: 3,
		observation: 2,
		procedure: 1,
		diagnosticreport: 2,
		medicationrequest: 21,
		medication: 9,
	},
	'IPS_TWCORE-MIX-003': {
		patient: 1,
		encounter: 5,
		organization: 1,
		practitionerrole: 2,
		practitioner: 2,
		observation: 3,
		procedure: 1,
		diagnosticreport: 3,
		medicationrequest: 12,
		condition: 1,
		medication: 4,
	},
	'IPS_TWCORE-OPD-010': {
		patient: 1,
		encounter: 5,
		organization: 1,
		practitionerrole: 2,
		practitioner: 2,
		observation: 3,
		diagnosticreport: 3,
		medicationrequest: 15,
		condition: 2,
		medication: 6,
	},
	'IPS_TWCORE-OPD-011': {
		patient: 1,
		encounter: 7,
		organization: 1,
		practitionerrole: 3,
		practitioner: 3,
		observation: 5,
		diagnosticreport: 5,
		medicationrequest: 21,
		condition: 3,
		medication: 9,
	},
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

test('migrated dataset scenarios resolve to explicit fixture counts', async () => {
	const repoRoot = path.resolve(import.meta.dirname, '../../..');
	const assets = await buildGeneratedAssets(path.join(repoRoot, 'dataset'));
	const scenarioIndex = JSON.parse(assets.assets.get('/data/scenario-index.json') ?? '{}') as {
		scenarios?: Array<{ id: string }>;
	};
	const scenarioIds = scenarioIndex.scenarios?.map((scenario) => scenario.id).sort() ?? [];

	assert.deepEqual(scenarioIds, Object.keys(EXPECTED_SCENARIO_COUNTS).sort());

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
