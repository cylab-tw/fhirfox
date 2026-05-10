import { randomFor } from '#/generators/random.js';

import type { GeneratorFunction } from '#/generators/types.js';

/** Generates a deterministic ISO datetime, optionally within a `between` range. */
export const dateTimeGenerator: GeneratorFunction = ([input], context) => {
	const between = readBetween(input);
	if (!between) {
		return context.now.toISOString();
	}

	const [start, end] = between.map((value) => new Date(value).valueOf());
	const random = randomFor(context, `dateTime:${between.join(':')}`);
	return new Date(start + Math.floor((end - start) * random)).toISOString();
};

function readBetween(input: unknown): [string, string] | undefined {
	if (typeof input !== 'object' || input === null) {
		return undefined;
	}

	const between = (input as Record<string, unknown>).between;
	return Array.isArray(between) && typeof between[0] === 'string' && typeof between[1] === 'string'
		? [between[0], between[1]]
		: undefined;
}
