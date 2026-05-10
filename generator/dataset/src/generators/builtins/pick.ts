import { randomFor } from '#/generators/random.js';

import type { GeneratorFunction } from '#/generators/types.js';

/** Picks one deterministic value from an array or `{ oneOf }` input. */
export const pickGenerator: GeneratorFunction = (args, context) => {
	const [first, second] = args;
	const values = Array.isArray(first) ? first : readValues(first);
	const options = Array.isArray(first) ? second : first;
	const candidates = readValues(options) ?? values ?? ['unknown'];
	const index = Math.floor(randomFor(context, `pick:${JSON.stringify(candidates)}`) * candidates.length);
	return candidates[Math.min(index, candidates.length - 1)];
};

function readValues(input: unknown): unknown[] | undefined {
	if (typeof input !== 'object' || input === null) {
		return undefined;
	}

	const oneOf = (input as Record<string, unknown>).oneOf;
	return Array.isArray(oneOf) ? oneOf : undefined;
}
