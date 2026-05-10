import { randomFor } from '#/generators/random.js';

import type { GeneratorFunction } from '#/generators/types.js';

/** Generates a deterministic number within optional `gt/gte/lt/lte` bounds. */
export const numberGenerator: GeneratorFunction = ([input], context) => {
	const options = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
	const min = readNumber(options.gte) ?? (readNumber(options.gt) !== undefined ? readNumber(options.gt)! + 1 : 0);
	const max = readNumber(options.lte) ?? (readNumber(options.lt) !== undefined ? readNumber(options.lt)! - 1 : 100);
	const decimals = readInteger(options.decimals) ?? 0;

	if (max < min) {
		throw new Error(`Invalid number bounds: max ${max} is smaller than min ${min}.`);
	}

	const random = randomFor(context, `number:${JSON.stringify(options)}`);
	if (decimals <= 0) {
		return min + Math.floor(random * (max - min + 1));
	}

	const scale = 10 ** decimals;
	const scaledMin = Math.round(min * scale);
	const scaledMax = Math.round(max * scale);
	return (scaledMin + Math.floor(random * (scaledMax - scaledMin + 1))) / scale;
};

function readNumber(value: unknown): number | undefined {
	return typeof value === 'number' ? value : undefined;
}

function readInteger(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}
