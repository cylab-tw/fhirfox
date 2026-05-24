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
				oneOf: [
					{
						type: 'array',
						items: { type: 'string' },
					},
					{
						type: 'object',
						additionalProperties: relationshipBindingSchema(),
					},
				],
			},
			references: {
				type: 'object',
				additionalProperties: {
					type: 'object',
					required: ['resourceTypes'],
					properties: {
						key: { type: 'string' },
						definition: { type: 'string' },
						resourceTypes: {
							type: 'array',
							items: { type: 'string' },
						},
					},
					additionalProperties: false,
				},
			},
			fields: {
				type: 'array',
				items: {
					type: 'object',
					required: ['id', 'type'],
					properties: {
						id: { type: 'string' },
						name: { type: 'string' },
						definition: { type: 'string' },
						summary: { type: 'string' },
						type: {
							enum: ['string', 'number', 'boolean', 'date', 'datetime', 'dateTime', 'code', 'identifier', 'reference'],
						},
						path: { type: 'string' },
						binding: { type: 'string' },
						cardinality: { type: 'string' },
						required: { type: 'boolean' },
						emit: { type: 'boolean' },
						default: {},
						input: { type: 'object' },
						reference: {
							oneOf: [
								{ type: 'string' },
								{
									type: 'object',
									required: ['binding'],
									properties: {
										binding: { type: 'string' },
									},
									additionalProperties: false,
								},
							],
						},
					},
					additionalProperties: false,
				},
			},
		},
		additionalProperties: false,
	};
}

function relationshipBindingSchema(): Record<string, unknown> {
	return {
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
	};
}
