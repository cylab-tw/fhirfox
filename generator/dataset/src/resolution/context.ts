import { createStableRandom } from '#/generators/index.js';

import type { ResolveScenarioOptions } from './types.js';

/** Resolve options after defaults have been applied. */
export type NormalizedResolveScenarioOptions = Required<Pick<ResolveScenarioOptions, 'seed' | 'now' | 'generatedAt'>> &
	Pick<ResolveScenarioOptions, 'includeExplanation' | 'codeMappings'>;

/** Holds deterministic state shared by one scenario resolution run. */
export class ResolutionContext {
	private readonly ids = new Map<string, number>();

	constructor(readonly options: NormalizedResolveScenarioOptions) {}

	/** Returns the next sequential id for a resource type. */
	nextId(resourceType: string): string {
		const next = (this.ids.get(resourceType) ?? 0) + 1;
		this.ids.set(resourceType, next);
		return String(next);
	}

	/** Returns deterministic randomness scoped by the global seed and local key. */
	random(key: string): number {
		return createStableRandom(`${this.options.seed}:${key}`)();
	}
}

/** Scopes deterministic generation to a scenario without changing the caller-facing seed. */
export function deriveScenarioSeed(seed: string, scenarioId: string): string {
	return `${seed}:scenario:${scenarioId}`;
}

/** Creates a resolution context with normalized time defaults. */
export function createResolutionContext(options: ResolveScenarioOptions): ResolutionContext {
	const now = options.now ?? new Date();
	return new ResolutionContext({
		seed: options.seed,
		now,
		generatedAt: options.generatedAt ?? now.toISOString(),
		includeExplanation: options.includeExplanation,
		codeMappings: options.codeMappings,
	});
}
