import type { FieldDefinition, ResourceTypeDefinition } from './types.js';

/** Reads a resource type definition or fails with an author-facing message. */
export function getResourceDefinition(
	definitions: Map<string, ResourceTypeDefinition>,
	resourceType: string,
): ResourceTypeDefinition {
	const definition = definitions.get(resourceType);

	if (!definition) {
		throw new Error(`Unknown resource type "${resourceType}".`);
	}

	return definition;
}

/** Finds one field definition by id within a resource type. */
export function getFieldDefinition(definition: ResourceTypeDefinition, fieldId: string): FieldDefinition | undefined {
	return definition.fields.find((field) => field.id === fieldId);
}
