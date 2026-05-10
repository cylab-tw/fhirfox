import { randomFor } from '#/generators/random.js';
import { readCaseValue } from './case.js';

import type { GeneratorFunction } from '#/generators/types.js';

/** Maps a profile input to either a literal number or deterministic numeric bounds. */
export const caseNumberGenerator: GeneratorFunction = (args, context) => {
	const options = readOptions(args);
	const value = readCaseValue(options, context);

	if (typeof value === 'number') {
		return value;
	}

	if (!isRecord(value)) {
		return undefined;
	}

	const bounds = isRecord(value.input) ? value.input : value;
	const min = readNumber(bounds.gte) ?? readNumber(bounds.min) ?? readNumber(bounds.rangeLow);
	const max = readNumber(bounds.lte) ?? readNumber(bounds.max) ?? readNumber(bounds.rangeHigh);
	const decimals = readInteger(bounds.decimals) ?? 0;

	if (min === undefined || max === undefined) {
		return undefined;
	}
	if (max < min) {
		throw new Error(`Invalid caseNumber bounds: max ${max} is smaller than min ${min}.`);
	}

	const random = randomFor(context, `caseNumber:${JSON.stringify(options)}:${JSON.stringify(value)}`);
	if (decimals <= 0) {
		return min + Math.floor(random * (max - min + 1));
	}

	const scale = 10 ** decimals;
	const scaledMin = Math.round(min * scale);
	const scaledMax = Math.round(max * scale);
	return (scaledMin + Math.floor(random * (scaledMax - scaledMin + 1))) / scale;
};

function readOptions(args: unknown[]): Record<string, unknown> {
	return args.reduce<Record<string, unknown>>((options, arg) => (isRecord(arg) ? { ...options, ...arg } : options), {});
}

function readNumber(value: unknown): number | undefined {
	return typeof value === 'number' ? value : undefined;
}

function readInteger(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
