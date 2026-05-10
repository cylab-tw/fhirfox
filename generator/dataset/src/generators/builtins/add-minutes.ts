import type { GeneratorFunction } from '#/generators/types.js';

/** Adds minutes to an ISO datetime string. */
export const addMinutesGenerator: GeneratorFunction = ([value, minutes]) => {
	if (typeof value !== 'string' || typeof minutes !== 'number') {
		return value;
	}

	return new Date(new Date(value).valueOf() + minutes * 60_000).toISOString();
};
