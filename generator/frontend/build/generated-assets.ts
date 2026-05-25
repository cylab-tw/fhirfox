import {
	assembleBundle,
	attachInternalSourceResourceType,
	convertResource,
	normalizeRuleSet,
	orderFhirResourceFields,
	orderSourceResourceFields,
	readSourceResourceType,
} from '../../converter/src/browser.ts';
import { createInMemoryDatasetProvider, resolveScenario } from '../../dataset/src/index.ts';
import path from 'node:path';

import {
	buildSourceFieldDocs,
	loadConverterRows,
	loadPresets,
	loadResourceDefinitions,
	loadScenarioLevelDefinitions,
	loadScenarios,
	toScenarioRecord,
} from './loaders.js';
import { createSourceResourceKey } from '../src/resource-mapping.js';

import type { DatasetProvider, ScenarioDefinition } from '../../dataset/src/index.ts';
import type {
	GeneratedAssetSet,
	ScenarioIndexRecord,
	ScenarioResourceMappingRecord,
	ScenarioResultRecord,
	SourceResource,
} from './types.js';
import type { ConverterRuleSet } from '../../converter/src/browser.ts';

const DATA_BASE_URL = '/data';

export async function buildGeneratedAssets(
	datasetRoot: string,
	appBaseUrl = '/',
	seed = '1234',
): Promise<GeneratedAssetSet> {
	const igName = 'tw.gov.mohw.twcore';
	const igVersion = '1.0.0';
	const generatedAt = new Date().toISOString();
	const resourceTypeDefinitions = await loadResourceDefinitions(`${datasetRoot}/definitions`);
	const presets = await loadPresets(`${datasetRoot}/presets`);
	const converterRows = await loadConverterRows(`${datasetRoot}/converter`, igName);
	const { docs: sourceFieldDocs, order: sourceFieldOrder } = buildSourceFieldDocs(resourceTypeDefinitions, {
		converterRows,
		igName,
		igVersion,
	});
	const sourceCodeDisplayMap = buildSourceCodeDisplayMap(converterRows);
	const levelDefinitions = await loadScenarioLevelDefinitions(`${datasetRoot}/scenarios/levels.json`);
	const scenarios = await loadScenarios(path.join(datasetRoot, '..', 'scenarios'));
	const scenarioRecords = scenarios.map(toScenarioRecord);
	const scenarioSource = scenarios.length > 0 ? 'authored' : 'missing';
	const assets = new Map<string, string>();
	const scenarioIndex: ScenarioIndexRecord = {
		generatedAt,
		scenarioSource,
		levelDefinitions,
		scenarios: scenarioRecords,
	};

	assets.set(`${DATA_BASE_URL}/scenario-index.json`, JSON.stringify(scenarioIndex));
	assets.set(`${DATA_BASE_URL}/source-field-docs.json`, JSON.stringify(sourceFieldDocs));
	assets.set(`${DATA_BASE_URL}/source-code-displays.json`, JSON.stringify(sourceCodeDisplayMap));

	if (scenarios.length > 0) {
		const provider = createInMemoryDatasetProvider({
			resourceTypeDefinitions,
			presets,
			codeMappings: converterRows.codeMappings,
		});
		const ruleSet = normalizeRuleSet(converterRows, igName, igVersion);
		ruleSet.sourceFieldOrder = sourceFieldOrder;

		for (const scenario of scenarios) {
			const sourceResult = await buildScenarioSourceResult(provider, scenario, ruleSet, seed);
			const { bundle, mapping } = buildScenarioBundle(sourceResult, ruleSet, igName, igVersion);
			const encodedScenarioId = encodeURIComponent(scenario.id);
			assets.set(`${DATA_BASE_URL}/scenarios/${encodedScenarioId}/source.json`, JSON.stringify(sourceResult));
			assets.set(`${DATA_BASE_URL}/scenarios/${encodedScenarioId}/bundle.json`, JSON.stringify(bundle));
			assets.set(`${DATA_BASE_URL}/scenarios/${encodedScenarioId}/mapping.json`, JSON.stringify(mapping));
		}
	}

	return {
		manifest: {
			generatedAt,
			dataSource: {
				kind: 'generated-asset',
				scenarioIndexUrl: toPublicUrl(appBaseUrl, `${DATA_BASE_URL}/scenario-index.json`),
				sourceFieldDocsUrl: toPublicUrl(appBaseUrl, `${DATA_BASE_URL}/source-field-docs.json`),
				sourceCodeDisplayMapUrl: toPublicUrl(appBaseUrl, `${DATA_BASE_URL}/source-code-displays.json`),
				scenarioAssetBaseUrl: toPublicUrl(appBaseUrl, `${DATA_BASE_URL}/scenarios`),
			},
		},
		assets,
	};
}

function buildSourceCodeDisplayMap(ruleSetRows: Awaited<ReturnType<typeof loadConverterRows>>): Record<string, string> {
	const mappingKeyByField = new Map(
		ruleSetRows.generatorRules.flatMap((row) =>
			row.transformKind === 'code_map' && row.mappingKey ? [[row.path.toLowerCase(), row.mappingKey] as const] : [],
		),
	);
	const displayMap: Record<string, string> = {};

	for (const row of ruleSetRows.codeMappings) {
		const displayValue = row.displayZhTw ?? row.targetDisplay;

		if (!displayValue) {
			continue;
		}

		for (const [fieldPath, mappingKey] of mappingKeyByField.entries()) {
			if (mappingKey !== row.mappingKey) {
				continue;
			}

			displayMap[`${fieldPath}:${row.sourceCode}`] = displayValue;
		}
	}

	for (const row of ruleSetRows.codeMappings) {
		const displayValue = row.displayZhTw ?? row.targetDisplay;

		if (row.mappingKey !== 'laboratoryresult-lab-code' || !displayValue) {
			continue;
		}

		displayMap[`observation.observationcode:${row.sourceCode}`] = displayValue;
	}

	return displayMap;
}

function toPublicUrl(baseUrl: string, assetPath: string): string {
	const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

	if (normalizedBaseUrl === '/') {
		return assetPath;
	}

	return `${normalizedBaseUrl.replace(/\/$/u, '')}${assetPath}`;
}

function normalizeBaseUrl(baseUrl: string): string {
	if (!baseUrl || baseUrl === '/') {
		return '/';
	}

	const trimmed = baseUrl.trim().replace(/^\/+|\/+$/gu, '');
	return trimmed ? `/${trimmed}/` : '/';
}

async function buildScenarioSourceResult(
	provider: DatasetProvider,
	scenario: ScenarioDefinition,
	ruleSet: ConverterRuleSet,
	seed: string,
): Promise<ScenarioResultRecord> {
	const resolved = await resolveScenario(provider, scenario, {
		seed,
	});
	const orderedResources = resolved.resources.map((resource) => {
		const typedResource = attachInternalSourceResourceType(resource.resource, resource.resourceType);
		return attachInternalSourceResourceType(orderSourceResourceFields(typedResource, ruleSet), resource.resourceType);
	});
	const groupedResources = groupSourceResources(orderedResources);

	return {
		scenarioId: scenario.id,
		resources: groupedResources,
		orderedResources,
		graph: resolved.graph,
		warnings: resolved.warnings.length > 0 ? resolved.warnings.map((warning) => warning.message) : undefined,
		meta: {
			directMatchCount: resolved.metadata.stats.explicitResourceCount,
			expandedMatchCount: resolved.metadata.stats.resourceCount,
			totalResources: orderedResources.length,
		},
	};
}

function groupSourceResources(resources: SourceResource[]): Record<string, SourceResource[]> {
	const grouped: Record<string, SourceResource[]> = {};

	for (const resource of resources) {
		const resourceType = readSourceResourceType(resource);
		grouped[resourceType] ??= [];
		grouped[resourceType].push(resource);
	}

	return grouped;
}

function buildScenarioBundle(
	result: ScenarioResultRecord,
	ruleSet: ConverterRuleSet,
	igName: string,
	igVersion: string,
) {
	const sourceKeys = result.orderedResources.map((resource, index) => createSourceResourceKey(resource, index));
	const bundleResources = result.orderedResources.map((resource) =>
		orderFhirResourceFields(
			convertResource(resource, ruleSet, {
				igName,
				igVersion,
			}),
			readSourceResourceType(resource),
			ruleSet,
		),
	);

	const mapping: ScenarioResourceMappingRecord = {
		orderedSourceKeys: sourceKeys,
		bundleEntrySourceKeys: sourceKeys,
	};

	return {
		bundle: assembleBundle(bundleResources, {}),
		mapping,
	};
}
