import type { GeneratorContext } from './types.js';

/** Creates a deterministic pseudo-random source from a stable seed string. */
export function createStableRandom(seed: string): () => number {
	let state = hash(seed);

	return () => {
		state = (state * 1664525 + 1013904223) >>> 0;
		return state / 0x100000000;
	};
}

/** Creates a keyed deterministic random function scoped to one generated record or field. */
export function createScopedRandom(seed: string, scope: string): (key: string) => number {
	return (key) => createStableRandom(`${seed}:${scope}:${key}`)();
}

/** Creates a deterministic keyed random function from a seed string. */
export function createSeededRandom(seed: string): (key: string) => number {
	return (key) => createStableRandom(`${seed}:${key}`)();
}

/** Reads a deterministic random value with record/field scope included in the key. */
export function randomFor(context: GeneratorContext, key: string): number {
	const scope = [context.resourceType, context.alias, context.field].filter(Boolean).join(':');
	return (scope ? createScopedRandom(context.seed, scope) : createSeededRandom(context.seed))(key);
}

function hash(input: string): number {
	let value = 2166136261;

	for (let index = 0; index < input.length; index += 1) {
		value ^= input.charCodeAt(index);
		value = Math.imul(value, 16777619);
	}

	return value >>> 0;
}
