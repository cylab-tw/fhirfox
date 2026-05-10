/** Creates the JSON Schema for preset YAML. */
export function createPresetJsonSchema(): Record<string, unknown> {
	return {
		$schema: 'https://json-schema.org/draft/2020-12/schema',
		title: 'FHIRfox Preset',
		type: 'object',
		required: ['id', 'resourceType'],
		properties: {
			id: { type: 'string' },
			resourceType: { type: 'string' },
			summary: { type: 'string' },
			overrides: {
				type: 'array',
				items: { type: 'string' },
			},
			fields: { type: 'object' },
			requires: {
				type: 'array',
				items: {
					oneOf: [aliasRequirementSchema(), bindingRequirementSchema()],
				},
			},
		},
		additionalProperties: false,
	};
}

function requirementBaseProperties(): Record<string, unknown> {
	return {
		with: {
			type: 'array',
			items: { type: 'string' },
		},
		cardinality: { type: 'string' },
		select: { type: 'object' },
		strategy: { enum: ['first', 'one', 'sample'] },
		preserveSelectionOrder: { type: 'boolean' },
	};
}

function aliasRequirementSchema(): Record<string, unknown> {
	return {
		type: 'object',
		required: ['alias', 'resourceType'],
		properties: {
			alias: { type: 'string' },
			resourceType: { type: 'string' },
			...requirementBaseProperties(),
		},
		additionalProperties: false,
	};
}

function bindingRequirementSchema(): Record<string, unknown> {
	return {
		type: 'object',
		required: ['binding'],
		properties: {
			binding: { type: 'string' },
			...requirementBaseProperties(),
		},
		additionalProperties: false,
	};
}
