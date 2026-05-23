/** Creates the JSON Schema for resource type definition YAML. */
export function createResourceDefinitionJsonSchema(): Record<string, unknown> {
	return {
		$schema: 'https://json-schema.org/draft/2020-12/schema',
		title: 'FHIRfox Resource Type Definition',
		type: 'object',
		required: ['resourceType', 'name', 'fields'],
		properties: {
			resourceType: { type: 'string' },
			name: { type: 'string' },
			summary: { type: 'string' },
			defaults: {
				type: 'object',
				properties: {
					with: {
						type: 'array',
						items: { type: 'string' },
					},
				},
				additionalProperties: false,
			},
			bindings: {
				type: 'object',
				additionalProperties: {
					type: 'object',
					required: ['name', 'resourceTypes'],
					properties: {
						key: { type: 'string' },
						name: { type: 'string' },
						resourceTypes: {
							type: 'array',
							items: { type: 'string' },
						},
						summary: { type: 'string' },
					},
					additionalProperties: false,
				},
			},
			fields: {
				type: 'array',
				items: {
					type: 'object',
					required: ['id', 'name', 'valueType'],
					properties: {
						id: { type: 'string' },
						name: { type: 'string' },
						summary: { type: 'string' },
						valueType: {
							enum: ['string', 'number', 'boolean', 'date', 'datetime', 'code', 'reference'],
						},
						path: { type: 'string' },
						cardinality: { type: 'string' },
						required: { type: 'boolean' },
						emit: { type: 'boolean' },
						default: { type: 'string' },
						input: { type: 'object' },
						reference: {
							type: 'object',
							required: ['binding'],
							properties: {
								binding: { type: 'string' },
							},
							additionalProperties: false,
						},
					},
					additionalProperties: false,
				},
			},
		},
		additionalProperties: false,
	};
}
