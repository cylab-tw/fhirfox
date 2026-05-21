/* eslint-disable sort-imports */
import { getBuiltinGeneratorNames, isGeneratorExpression, parseExpression } from '#/generators/index.js';
import { createError } from '#/validation/index.js';
import type { ResourceTypeDefinition } from './types.js';
import type { ValidationIssue } from '#/validation/index.js';

/** Validates resource type definitions before scenarios use them. */
export function validateResourceDefinitions(definitions: ResourceTypeDefinition[]): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const knownResourceTypes = new Set(definitions.map((definition) => definition.resourceType));
	const bindingKeys = new Map<string, string[]>();
	const seen = new Set<string>();
	const generatorNames = new Set(getBuiltinGeneratorNames());

	for (const definition of definitions) {
		if (!definition.resourceType) {
			issues.push(createError('resource.missingResourceType', 'Resource definition is missing resourceType.'));
		}
		if (!definition.name) {
			issues.push(
				createError('resource.missingName', `Resource definition "${definition.resourceType}" is missing name.`),
			);
		}

		if (seen.has(definition.resourceType)) {
			issues.push(createError('resource.duplicateType', `Duplicate resource type "${definition.resourceType}".`));
		}
		seen.add(definition.resourceType);

		const fieldIds = new Set<string>();
		for (const field of definition.fields) {
			if (!field.id) {
				issues.push(createError('resource.missingFieldId', `Field in "${definition.resourceType}" is missing id.`));
			}
			if (!field.name) {
				issues.push(
					createError(
						'resource.missingFieldName',
						`Field "${field.id}" in "${definition.resourceType}" is missing name.`,
					),
				);
			}

			if (fieldIds.has(field.id)) {
				issues.push(
					createError('resource.duplicateField', `Duplicate field "${field.id}" in "${definition.resourceType}".`),
				);
			}
			fieldIds.add(field.id);

			const generatorName = readGeneratorName(field.default);
			if (generatorName && !generatorNames.has(generatorName)) {
				issues.push(
					createError(
						'resource.unknownGenerator',
						`Field "${field.id}" in "${definition.resourceType}" uses unknown generator "${generatorName}".`,
					),
				);
			}
		}

		for (const [bindingId, binding] of Object.entries(definition.bindings ?? {})) {
			const key = binding.key ?? `${definition.resourceType}.${bindingId}`;
			const resourceTypes = normalizeResourceTypes(binding.resourceTypes);
			const previous = bindingKeys.get(key);

			if (previous && !sameResourceTypes(previous, resourceTypes)) {
				issues.push(createError('resource.bindingKeyConflict', `Binding key "${key}" has conflicting resource types.`));
			}
			bindingKeys.set(key, resourceTypes);

			if (!binding.name) {
				issues.push(
					createError(
						'resource.missingBindingName',
						`Binding "${bindingId}" in "${definition.resourceType}" is missing name.`,
					),
				);
			}
			if (resourceTypes.length === 0) {
				issues.push(
					createError(
						'resource.missingBindingResourceType',
						`Binding "${bindingId}" in "${definition.resourceType}" must declare at least one resource type.`,
					),
				);
			}
			for (const resourceType of resourceTypes) {
				if (!knownResourceTypes.has(resourceType)) {
					issues.push(
						createError(
							'resource.unknownBindingResourceType',
							`Binding "${bindingId}" in "${definition.resourceType}" targets unknown resource type "${resourceType}".`,
						),
					);
				}
			}
		}

		for (const field of definition.fields) {
			if (field.type !== 'reference') {
				continue;
			}

			const bindingId = field.reference?.binding;
			if (!bindingId) {
				issues.push(
					createError(
						'resource.missingReferenceBinding',
						`Field "${field.id}" in "${definition.resourceType}" must declare a binding.`,
					),
				);
				continue;
			}

			if (!definition.bindings?.[bindingId]) {
				issues.push(
					createError(
						'resource.unknownReferenceBinding',
						`Field "${field.id}" in "${definition.resourceType}" uses unknown binding "${bindingId}".`,
					),
				);
			}
		}
	}

	return issues;
}

function normalizeResourceTypes(resourceTypes: string[] | undefined): string[] {
	return Array.from(
		new Set((resourceTypes ?? []).filter((value): value is string => typeof value === 'string' && value.length > 0)),
	);
}

function sameResourceTypes(left: string[], right: string[]): boolean {
	if (left.length !== right.length) {
		return false;
	}

	const sortedLeft = [...left].sort();
	const sortedRight = [...right].sort();

	return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function readGeneratorName(value: unknown): string | undefined {
	if (!isGeneratorExpression(value)) {
		return undefined;
	}

	return parseExpression(value).name;
}
