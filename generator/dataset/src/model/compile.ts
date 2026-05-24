import { validateResourceDefinitions } from './validate.js';

import type {
	CompileResourceDefinitionsOptions,
	FieldDefinition,
	ResourceBindingDefinition,
	ResourceDefinitionArtifact,
	ResourceTypeDefinition,
} from './types.js';

/** Validates loaded resource type definitions. */
export function compileResourceDefinitions(options: CompileResourceDefinitionsOptions): ResourceDefinitionArtifact {
	const resourceTypeDefinitions = options.definitions.map(normalizeResourceDefinition);

	return {
		resourceTypeDefinitions,
		issues: validateResourceDefinitions(resourceTypeDefinitions),
	};
}

/** Converts authored resource definitions into the internal relationship model. */
export function normalizeResourceDefinition(definition: ResourceTypeDefinition): ResourceTypeDefinition {
	const bindings = normalizeRelationshipBindings(definition);

	return {
		...definition,
		bindings,
		fields: definition.fields.map((field) => normalizeField(field)),
	};
}

function normalizeRelationshipBindings(
	definition: ResourceTypeDefinition,
): Record<string, ResourceBindingDefinition> | undefined {
	const normalized: Record<string, ResourceBindingDefinition> = {};
	const authoredBindings = definition.bindings as ResourceTypeDefinition['bindings'] | string[] | undefined;

	if (definition.references) {
		for (const [referenceId, reference] of Object.entries(definition.references)) {
			normalized[referenceId] = {
				key: reference.key ?? referenceId,
				name: toDisplayName(referenceId),
				resourceTypes: reference.resourceTypes,
				summary: reference.definition,
			};
		}
	}

	if (definition.resourceType === 'organization' && !normalized.provider) {
		normalized.provider = {
			key: 'provider',
			name: 'Provider',
			resourceTypes: ['organization'],
			summary: 'Care or data provider organization.',
		};
	}

	if (!Array.isArray(authoredBindings)) {
		for (const [bindingId, binding] of Object.entries(authoredBindings ?? {})) {
			normalized[bindingId] = binding;
		}
	}

	return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeField(field: FieldDefinition): FieldDefinition {
	const authoredReference = field.reference as FieldDefinition['reference'] | string | undefined;
	const reference =
		typeof authoredReference === 'string'
			? {
					binding: authoredReference,
				}
			: authoredReference;

	return {
		...field,
		name: field.name ?? toDisplayName(field.id),
		summary: field.summary ?? field.definition,
		type: field.type === 'dateTime' ? 'datetime' : field.type,
		reference,
	};
}

function toDisplayName(value: string): string {
	return value
		.replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
		.replace(/[-_.]+/gu, ' ')
		.replace(/\b\w/gu, (match) => match.toUpperCase());
}
