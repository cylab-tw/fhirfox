import type { ReferenceSpec } from '#/references/index.js';

/** Authored scenario before records are generated. */
export interface ScenarioDefinition {
	/** Stable scenario id. */
	id: string;
	/** Human-readable scenario name. */
	name: string;
	summary?: string;
	details?: string;
	level?: number;
	scenarioType?: string;
	/** Resource instances the scenario asks the resolver to create or select. */
	resources: ScenarioResourceDefinition[];
}

/** One requested record in a scenario. */
export interface ScenarioResourceDefinition {
	/** Scenario-local name used by `$ref(...)` and object references. */
	alias: string;
	/** Resource type to generate, such as `patient` or `encounter`. */
	resourceType: string;
	/** Binding keys this alias should satisfy for other generated records. */
	as?: string[];
	/** Preset ids to apply after the resource type's default presets. */
	with?: string[];
	/** Reference fields to fill from aliases or provider-backed selections. */
	references?: Record<string, ReferenceSpec>;
	/** Inputs merged into field defaults and generator profile selectors. */
	inputs?: Record<string, unknown>;
	/** Generate this many copies, suffixing aliases with `.1`, `.2`, and so on. */
	count?: number;
}

/** Scenario-resource keys that are syntax rather than field shorthand. */
export const scenarioResourceReservedKeys = new Set([
	'alias',
	'resourceType',
	'as',
	'with',
	'references',
	'inputs',
	'count',
]);
