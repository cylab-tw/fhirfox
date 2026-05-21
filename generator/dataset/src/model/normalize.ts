import type { FieldDefinition, ResourceTypeDefinition } from './types.js';

/** Builds a lookup table keyed by `resourceType`. */
export function indexResourceDefinitions(definitions: ResourceTypeDefinition[]): Map<string, ResourceTypeDefinition> {
	return new Map(definitions.map((definition) => [definition.resourceType, definition]));
}

/** Builds a lookup table keyed by field id for one resource type. */
export function indexFields(definition: ResourceTypeDefinition): Map<string, FieldDefinition> {
	return new Map(definition.fields.map((field) => [field.id, field]));
}
