import {
	assembleBundle,
	attachInternalSourceResourceType,
	convertResource,
	normalizeRuleSet,
	orderFhirResourceFields,
	orderSourceResourceFields,
	orderSourceResources,
	readSourceResourceType,
} from '@fhirfox/converter/browser';
import { deriveResourceLinks, resolveScenario } from '../../dataset/src/index.ts';

import {
	loadConverterRows,
	loadResources,
	loadScenarioLevelDefinitions,
	loadScenarios,
	loadSourceFieldDocs,
} from './loaders.js';
import { toIndexedResource, toSourceResourceRecord } from '../src/source-resource-bridge.js';
import { createInMemoryProvider } from './provider.js';
import { createSourceResourceKey } from '../src/resource-mapping.js';

import type {
	GeneratedAssetSet,
	ScenarioIndexRecord,
	ScenarioRecord,
	ScenarioResourceMappingRecord,
	ScenarioResultRecord,
} from './types.js';
import type { ConverterRuleSet } from '@fhirfox/converter/browser';
import type { DatasetProvider } from '../../dataset/src/index.ts';
import type { Scenario } from '../../dataset/src/index.ts';

const DATA_BASE_URL = '/data';

export async function buildGeneratedAssets(
	datasetRoot: string,
	scenariosRoot: string,
	appBaseUrl = '/',
): Promise<GeneratedAssetSet> {
	const igName = 'tw.gov.mohw.twcore';
	const igVersion = '1.0.0';
	const generatedAt = new Date().toISOString();
	const sourceResources = await loadResources(`${datasetRoot}/resources`);
	const {
		docs: sourceFieldDocs,
		order: sourceFieldOrder,
		schema,
	} = await loadSourceFieldDocs(`${datasetRoot}/resources/definitions`);
	const links = deriveResourceLinks(schema);
	const converterRows = await loadConverterRows(`${datasetRoot}/converter`, igName);
	const sourceCodeDisplayMap = buildSourceCodeDisplayMap(converterRows);
	const levelDefinitions = await loadScenarioLevelDefinitions(`${datasetRoot}/scenarios/levels.json`);
	const scenarios = await loadScenarios(scenariosRoot);
	const scenarioSource = scenarios.length > 0 ? 'authored' : 'missing';
	const assets = new Map<string, string>();
	const scenarioIndex: ScenarioIndexRecord = {
		generatedAt,
		scenarioSource,
		levelDefinitions,
		scenarios,
	};

	assets.set(`${DATA_BASE_URL}/scenario-index.json`, JSON.stringify(scenarioIndex));
	assets.set(`${DATA_BASE_URL}/source-field-docs.json`, JSON.stringify(sourceFieldDocs));
	assets.set(`${DATA_BASE_URL}/source-code-displays.json`, JSON.stringify(sourceCodeDisplayMap));

	if (scenarios.length > 0) {
		const indexedResources = sourceResources.map((resource) => toIndexedResource(resource));
		const provider = createInMemoryProvider(indexedResources, links);
		const ruleSet = normalizeRuleSet(converterRows, igName, igVersion);
		ruleSet.sourceFieldOrder = sourceFieldOrder;

		for (const scenario of scenarios) {
			const sourceResult = await buildScenarioSourceResult(provider, scenario, ruleSet);
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
			row.transformKind === 'code_map' && row.mappingKey
				? [[`${row.resourceType.toLowerCase()}.${row.sourceColumn}`, row.mappingKey] as const]
				: [],
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
	scenario: ScenarioRecord,
	ruleSet: ConverterRuleSet,
): Promise<ScenarioResultRecord> {
	const resolved = await resolveScenario(provider, scenario as Scenario);
	const ordered = orderSourceResources(resolved.orderedResources.map((resource) => toSourceResourceRecord(resource)));
	const orderedResources = ordered.orderedResources.map((resource) =>
		attachInternalSourceResourceType(orderSourceResourceFields(resource, ruleSet), readSourceResourceType(resource)),
	);
	const groupedResources = Object.fromEntries(
		Object.entries(ordered.groupedResources).map(([resourceType, resources]) => [
			resourceType,
			resources.map((resource) =>
				attachInternalSourceResourceType(orderSourceResourceFields(resource, ruleSet), resourceType),
			),
		]),
	);

	return {
		scenarioId: scenario.id,
		resources: groupedResources,
		orderedResources,
		warnings: resolved.warnings,
		meta: {
			directMatchCount: resolved.meta?.directMatchCount ?? 0,
			expandedMatchCount: resolved.meta?.expandedMatchCount ?? 0,
			totalResources: orderedResources.length,
		},
	};
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
