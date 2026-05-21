import type { Preset } from '#/preset/index.js';
import type { ResourceTypeDefinition } from '#/model/index.js';

/** Creates the JSON Schema for scenario YAML from known resource types and presets. */
export function createScenarioJsonSchema(
	definitions: ResourceTypeDefinition[],
	presets: Preset[],
): Record<string, unknown> {
	return {
		$schema: 'https://json-schema.org/draft/2020-12/schema',
		title: 'FHIRfox Scenario',
		type: 'object',
		required: ['id', 'name', 'resources'],
		properties: {
			id: { type: 'string' },
			name: { type: 'string' },
			summary: { type: 'string' },
			details: { type: 'string' },
			level: { type: 'number' },
			scenarioType: { type: 'string' },
			resources: {
				type: 'array',
				items: { oneOf: definitions.map((definition) => resourceSchema(definition, presets)) },
			},
		},
		additionalProperties: false,
	};
}

function resourceSchema(definition: ResourceTypeDefinition, presets: Preset[]): Record<string, unknown> {
	return {
		type: 'object',
		required: ['alias', 'resourceType'],
		properties: {
			alias: { type: 'string' },
			resourceType: { const: definition.resourceType },
			as: {
				type: 'array',
				items: { type: 'string' },
			},
			with: {
				type: 'array',
				items: {
					enum: presets.filter((preset) => preset.resourceType === definition.resourceType).map((preset) => preset.id),
				},
			},
			inputs: { type: 'object' },
			references: { type: 'object' },
			count: { type: 'integer', minimum: 1 },
		},
		additionalProperties: false,
	};
}
