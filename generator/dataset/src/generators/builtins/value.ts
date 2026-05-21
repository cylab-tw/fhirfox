import type { GeneratorFunction } from '#/generators/types.js';

/** Reads a field value already produced for the current source record. */
export const valueGenerator: GeneratorFunction = ([name], context) =>
	typeof name === 'string' ? context.values[name] : undefined;
