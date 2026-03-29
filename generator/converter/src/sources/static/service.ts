import { normalizeSourceResourceType, readNormalizedSourceResourceType } from '../../source-resource.js';
import { orderFhirResourceFields, orderSourceResources } from '../../order/canonical.js';
import { assembleBundle } from '../../bundle/assemble.js';
import { convertResource } from '../../engine/convert-resource.js';
import { loadStaticConverterRows } from '../../rules/load.js';
import { normalizeRuleSet } from '../../rules/normalize.js';
import { parse } from 'yaml';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

import type { ConvertOptions, ConverterRuleSet, ConverterService, StaticConverterServiceOptions } from '../../types.js';

/**
 * Creates a converter service backed by static CSV assets on disk.
 */
export function createStaticConverterService(options: StaticConverterServiceOptions): ConverterService {
	const cache = new Map<string, Promise<ConverterRuleSet>>();

	return {
		async toFhirResource(input, convertOptions) {
			const ruleSet = await getRuleSet(cache, options, convertOptions);
			return orderFhirResourceFields(
				convertResource(input, ruleSet, convertOptions),
				readNormalizedSourceResourceType(input),
				ruleSet,
			);
		},

		async toFhirBundle(inputs, convertOptions) {
			const ruleSet = await getRuleSet(cache, options, convertOptions);
			const resources = orderSourceResources(
				inputs.map((input) => normalizeSourceResourceType(input)),
			).orderedResources.map((input) =>
				orderFhirResourceFields(
					convertResource(input, ruleSet, convertOptions),
					readNormalizedSourceResourceType(input),
					ruleSet,
				),
			);
			return assembleBundle(resources, convertOptions);
		},
	};
}

async function getRuleSet(
	cache: Map<string, Promise<ConverterRuleSet>>,
	serviceOptions: StaticConverterServiceOptions,
	convertOptions: ConvertOptions,
): Promise<ConverterRuleSet> {
	const cacheKey = `${convertOptions.igName}@${convertOptions.igVersion}`;
	let cached = cache.get(cacheKey);

	if (!cached) {
		cached = Promise.all([
			loadStaticConverterRows(serviceOptions.baseDir, convertOptions.igName),
			loadSourceFieldOrder(path.resolve(serviceOptions.baseDir, '..', 'resources', 'definitions')),
		]).then(([rows, fieldOrder]) => {
			const ruleSet = normalizeRuleSet(rows, convertOptions.igName, convertOptions.igVersion);
			ruleSet.sourceFieldOrder = fieldOrder;
			return ruleSet;
		});
		cache.set(cacheKey, cached);
	}

	return cached;
}

async function loadSourceFieldOrder(directoryPath: string): Promise<Record<string, string[]>> {
	try {
		const { readdir } = await import('node:fs/promises');
		const entries = await readdir(directoryPath, { withFileTypes: true });
		const docFiles = entries
			.filter((entry) => entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')))
			.map((entry) => path.join(directoryPath, entry.name))
			.sort();
		const orders = await Promise.all(
			docFiles.map(async (filePath) => {
				const content = await readFile(filePath, 'utf8');
				return flattenSourceFieldOrder(parse(content) as Record<string, unknown>);
			}),
		);

		return Object.assign({}, ...orders);
	} catch {
		return {};
	}
}

function flattenSourceFieldOrder(document: Record<string, unknown>): Record<string, string[]> {
	const order: Record<string, string[]> = {};

	for (const [key, value] of Object.entries(document)) {
		if (typeof value !== 'object' || value === null || Array.isArray(value)) {
			continue;
		}

		const record = value as Record<string, unknown>;
		const { description, cardinality, ...nested } = record;
		void description;
		void cardinality;
		order[key.toLowerCase()] = Object.keys(nested);
	}

	return order;
}
