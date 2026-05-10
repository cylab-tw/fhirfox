import { createBuiltinGeneratorEntries } from '#/generators/builtins/index.js';

import type { GeneratorRegistry } from './types.js';

/** Creates the built-in expression registry used by scenario resolution. */
export function createDefaultGeneratorRegistry(): GeneratorRegistry {
	return new Map(createBuiltinGeneratorEntries());
}

/** Returns the built-in generator names supported by this package. */
export function getBuiltinGeneratorNames(): string[] {
	return createBuiltinGeneratorEntries().map(([name]) => name);
}
