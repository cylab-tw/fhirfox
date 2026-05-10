import { createError, createWarning } from '#/validation/index.js';
import {
	getBuiltinGeneratorNames,
	isGeneratorExpression,
	parseExpression,
	readReferenceExpression,
} from '#/generators/index.js';

import type { Preset } from './types.js';
import type { ResourceTypeDefinition } from '#/model/index.js';
import type { ValidationIssue } from '#/validation/index.js';

/** Validates presets against known resource types, fields, and bindings. */
export function validatePresets(presets: Preset[], definitions: ResourceTypeDefinition[]): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const resourceTypes = new Set(definitions.map((definition) => definition.resourceType));
	const definitionIndex = new Map(definitions.map((definition) => [definition.resourceType, definition]));
	const presetIndex = new Map(presets.map((preset) => [preset.id, preset]));
	const seen = new Set<string>();
	const generatorNames = new Set(getBuiltinGeneratorNames());

	for (const preset of presets) {
		if (seen.has(preset.id)) {
			issues.push(createError('preset.duplicateId', `Duplicate preset "${preset.id}".`));
		}
		seen.add(preset.id);

		if (!resourceTypes.has(preset.resourceType)) {
			issues.push(createError('preset.unknownResourceType', `Preset "${preset.id}" uses unknown resource type.`));
		}

		const definition = definitionIndex.get(preset.resourceType);
		for (const requirement of preset.requires ?? []) {
			if ('binding' in requirement) {
				const binding = definition?.bindings?.[requirement.binding];
				if (!binding) {
					issues.push(
						createError(
							'preset.unknownBinding',
							`Preset "${preset.id}" uses unknown binding "${requirement.binding}".`,
						),
					);
					continue;
				}
				if ('resourceType' in requirement) {
					issues.push(
						createError(
							'preset.invalidRequirement',
							`Preset "${preset.id}" binding requirement must not declare resourceType.`,
						),
					);
				}
				continue;
			}

			if (!requirement.alias || !requirement.resourceType) {
				issues.push(
					createError('preset.invalidRequirement', `Preset "${preset.id}" requirement needs alias and resourceType.`),
				);
			}
		}

		for (const [fieldId, value] of Object.entries(preset.fields ?? {})) {
			if (isGeneratorOnlyObject(value)) {
				issues.push(
					createWarning(
						'preset.preferConciseGenerator',
						`Preset "${preset.id}" field "${fieldId}" should use the concise generator form.`,
					),
				);
			}

			const generatorName = readGeneratorName(value);
			if (generatorName && !generatorNames.has(generatorName)) {
				issues.push(
					createError(
						'preset.unknownGenerator',
						`Preset "${preset.id}" field "${fieldId}" uses unknown generator "${generatorName}".`,
					),
				);
			}

			const expression = readReferenceExpression(
				typeof value === 'object' && value !== null && 'value' in value ? value.value : value,
			);
			if (expression?.kind !== 'bindingRef') {
				continue;
			}

			const binding = expression.value;
			if (!definition?.bindings?.[binding]) {
				issues.push(
					createError('preset.unknownBindingRef', `Preset "${preset.id}" uses unknown binding "${binding}".`),
				);
			}
		}
	}

	for (const definition of definitions) {
		for (const presetId of definition.defaults?.with ?? []) {
			const preset = presetIndex.get(presetId);
			if (!preset) {
				issues.push(createError('resource.defaultPresetUnknown', `Unknown default preset "${presetId}".`));
				continue;
			}
			if (preset.resourceType !== definition.resourceType) {
				issues.push(
					createError(
						'resource.defaultPresetTypeMismatch',
						`Default preset "${presetId}" cannot be applied to "${definition.resourceType}".`,
					),
				);
			}
		}

		issues.push(...findPresetCollisions(definition.defaults?.with ?? [], presetIndex, definition.resourceType));
	}

	return issues;
}

function isGeneratorOnlyObject(value: unknown): boolean {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		Object.keys(value).length === 1 &&
		typeof (value as Record<string, unknown>).generator === 'string'
	);
}

function readGeneratorName(value: unknown): string | undefined {
	if (typeof value === 'string' && isGeneratorExpression(value)) {
		return parseExpression(value).name;
	}

	if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
		const record = value as Record<string, unknown>;
		if (typeof record.generator === 'string' && isGeneratorExpression(record.generator)) {
			return parseExpression(record.generator).name;
		}
		if (typeof record.value === 'string' && isGeneratorExpression(record.value)) {
			return parseExpression(record.value).name;
		}
	}

	return undefined;
}

function findPresetCollisions(ids: string[], presets: Map<string, Preset>, resourceType: string): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const fields = new Map<string, string>();

	for (const id of ids) {
		const preset = presets.get(id);
		if (!preset) {
			continue;
		}

		for (const field of Object.keys(preset.fields ?? {})) {
			const previous = fields.get(field);
			if (previous && !preset.overrides?.includes(field)) {
				issues.push(
					createWarning(
						'preset.fieldCollision',
						`Preset "${id}" overrides field "${field}" from "${previous}" on "${resourceType}".`,
					),
				);
			}
			fields.set(field, id);
		}
	}

	return issues;
}
