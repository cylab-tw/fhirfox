import { randomFor } from '#/generators/random.js';

import type { CodeMappingDefinition } from '#/model/index.js';
import type { GeneratorContext, GeneratorFunction } from '#/generators/types.js';

/** Generates a deterministic random value or samples one from a code mapping. */
export const randomGenerator: GeneratorFunction = ([input], context) => {
	const options = isRecord(input) ? input : {};
	const candidates = readCandidates(options, context);

	if (candidates.length > 0) {
		return pick(candidates, options, context);
	}

	return randomFor(context, `random:${JSON.stringify(options)}`);
};

function readCandidates(options: Record<string, unknown>, context: GeneratorContext): unknown[] {
	const oneOf = readArray(options.oneOf);
	if (oneOf) {
		return oneOf;
	}

	const mappingKey =
		readString(options.codeMap) ??
		readString(options.binding) ??
		(context.field ? context.codeMappingByField?.[context.field] : undefined);
	if (!mappingKey) {
		return [];
	}

	const valueField = readString(options.value) ?? 'sourceCode';
	return (context.codeMappings ?? [])
		.filter((row) => row.mappingKey === mappingKey && row.isActive !== false)
		.map((row) => readMappingValue(row, valueField))
		.filter((value): value is string => typeof value === 'string' && value.length > 0);
}

function readMappingValue(row: CodeMappingDefinition, valueField: string): unknown {
	switch (valueField) {
		case 'source':
		case 'sourceCode':
			return row.sourceCode;
		case 'target':
		case 'targetCode':
			return row.targetCode;
		case 'display':
		case 'targetDisplay':
			return row.targetDisplay;
		case 'system':
		case 'targetSystem':
			return row.targetSystem;
		case 'displayZhTw':
			return row.displayZhTw;
		default:
			return row[valueField as keyof CodeMappingDefinition];
	}
}

function pick(candidates: unknown[], options: Record<string, unknown>, context: GeneratorContext): unknown {
	const random = randomFor(context, `random:pick:${JSON.stringify(options)}:${JSON.stringify(candidates)}`);
	const index = Math.floor(random * candidates.length);
	return candidates[Math.min(index, candidates.length - 1)];
}

function readArray(value: unknown): unknown[] | undefined {
	return Array.isArray(value) ? value : undefined;
}

function readString(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
