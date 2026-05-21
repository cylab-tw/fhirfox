import type { ValidationIssue } from '#/validation/index.js';

/** Presets that always apply before scenario-selected presets. */
export interface ResourceTypeDefaults {
	/** Preset ids to apply whenever this resource type is generated. */
	with?: string[];
}

/**
 * Named relationship slot exposed by a resource type.
 *
 * A binding lets presets and scenarios talk about a relationship without naming
 * the concrete alias up front. For example, an encounter can declare a
 * `serviceProvider` binding that expects an `organization`.
 */
export interface ResourceBindingDefinition {
	/** Optional global binding key; defaults to `<resourceType>.<bindingId>`. */
	key?: string;
	/** Human-readable label for UI display and dataset authors. */
	name: string;
	/** Resource types expected to fill this relationship slot. */
	resourceTypes: string[];
	/** Optional short description for UI display and dataset authors. */
	summary?: string;
}

/** Value kinds that dataset authors can assign to generated source fields. */
export type FieldValueType = 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'code' | 'reference';

/** Fallback value used when a field is not set by a preset or scenario. */
export type FieldDefaultValue = string | number | boolean | null | Array<unknown> | Record<string, unknown>;

/** Named options passed into a computed field default. */
export type GeneratorInput = Record<string, unknown>;

/** Binding-backed reference metadata used when this field stores another record's id. */
export interface FieldReferenceDefinition {
	/** Binding to use when the scenario does not explicitly author this reference field. */
	binding: string;
}

/** Defines one field on a generated source record. */
export interface FieldDefinition {
	/** Stable field id used by presets, scenarios, and generated output. */
	id: string;
	/** Human-readable label for UI display and dataset authors. */
	name: string;
	/** Optional short description for UI display and dataset authors. */
	summary?: string;
	/** Optional free-form Markdown details for longer field guidance. */
	details?: string;
	/** Authoring-level value kind expected for this field. */
	type: FieldValueType;
	/** Downstream mapping path, such as `encounter.periodStart`. */
	path: string;
	/** Source authoring cardinality, such as `0..1`; used for generated docs. */
	cardinality?: string;
	/** FHIR mapping path shown in frontend field docs. */
	fhirMapping?: string;
	/** Whether the field should have a value after resolution. */
	required: boolean;
	/** Whether the field should appear in the emitted source record. Default is `true`. */
	emit?: boolean;
	/** Fallback literal value or `$name(...)` expression used when no preset or scenario value is provided. */
	default?: FieldDefaultValue;
	/** Options merged into the field default when it is evaluated. */
	input?: GeneratorInput;
	/** Reference metadata used when this field stores another record's id. */
	reference?: FieldReferenceDefinition;
}

/** Defines one kind of generated source record, such as patient or encounter. */
export interface ResourceTypeDefinition {
	/** Stable machine name for this source record kind. */
	resourceType: string;
	/** Human-readable label for UI display and dataset authors. */
	name: string;
	/** Optional short description for UI display and dataset authors. */
	summary?: string;
	/** Presets that apply before scenario-selected presets. */
	defaults?: ResourceTypeDefaults;
	/** Relationship slots this resource type exposes to presets and scenarios. */
	bindings?: Record<string, ResourceBindingDefinition>;
	/** Fields available on generated records of this resource type. */
	fields: FieldDefinition[];
}

/** Input accepted by the resource type compiler. */
export interface CompileResourceDefinitionsOptions {
	/** Resource type definitions loaded from dataset files. */
	definitions: ResourceTypeDefinition[];
}

/** Normalized resource type definitions plus validation issues. */
export interface ResourceDefinitionArtifact {
	resourceTypeDefinitions: ResourceTypeDefinition[];
	issues: ValidationIssue[];
}

/** Source JSON record emitted by scenario resolution. */
export type SourceResource = Record<string, unknown> & {
	/** Stable id emitted for references and graph keys. */
	id: string;
};
