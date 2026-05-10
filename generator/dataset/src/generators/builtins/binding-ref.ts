import type { GeneratorFunction } from '#/generators/types.js';

/** Reads the emitted id for a named binding in the current resource context. */
export const bindingRefGenerator: GeneratorFunction = ([binding], context) =>
	typeof binding === 'string' ? context.bindingRef(binding) : undefined;
