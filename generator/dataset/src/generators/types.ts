import type { CodeMappingDefinition } from '#/model/index.js';

/** Function behind a `$name(...)` expression. */
export type GeneratorFunction = (args: unknown[], context: GeneratorContext) => unknown;

/** Runtime data available while evaluating a default or preset expression. */
export interface GeneratorContext {
	/** Seed used for repeatable generated values. */
	seed: string;
	/** Clock value used by date/time expressions. */
	now: Date;
	/** Resource type currently being emitted. */
	resourceType: string;
	/** Scenario alias currently being emitted. */
	alias: string;
	/** Field currently being filled, when the caller can provide it. */
	field?: string;
	/** Scenario inputs for the current resource, including non-field generator parameters. */
	inputs: Record<string, unknown>;
	/** Field values already produced for the current record. */
	values: Record<string, unknown>;
	/** Code mappings available for binding-backed random value generation. */
	codeMappings?: CodeMappingDefinition[];
	/** Code mapping key by field id for the current resource definition. */
	codeMappingByField?: Record<string, string>;
	/** Allocate the next id for a resource type. */
	nextId(resourceType: string): string;
	/** Deterministic random number for the supplied key. Generator code adds record/field scope. */
	random(key: string): number;
	/** Read the emitted id for another scenario alias. */
	ref(alias: string): string | undefined;
	/** Read the emitted id for a binding in the current resource context. */
	bindingRef(binding: string): string | undefined;
}

/** Lookup table from expression name to implementation. */
export type GeneratorRegistry = Map<string, GeneratorFunction>;

/** Parsed `$name(...)` expression before evaluation. */
export interface ParsedExpression {
	name: string;
	args: unknown[];
}
