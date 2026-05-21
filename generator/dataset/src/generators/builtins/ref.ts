import type { GeneratorFunction } from '#/generators/types.js';

/** Reads the emitted id for another resolved scenario alias. */
export const refGenerator: GeneratorFunction = ([alias], context) =>
	typeof alias === 'string' ? context.ref(alias) : undefined;
