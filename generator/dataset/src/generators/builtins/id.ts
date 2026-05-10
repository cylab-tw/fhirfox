import type { GeneratorFunction } from '#/generators/types.js';

/** Generates deterministic sequential ids per resource type. */
export const idGenerator: GeneratorFunction = ([resourceType], context) =>
	context.nextId(typeof resourceType === 'string' ? resourceType : context.resourceType);
