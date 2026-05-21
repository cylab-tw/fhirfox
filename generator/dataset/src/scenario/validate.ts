/* eslint-disable sort-imports */
import { getBuiltinGeneratorNames, isGeneratorExpression, parseExpression } from '#/generators/index.js';
import type { ResourceBindingDefinition, ResourceTypeDefinition } from '#/model/index.js';
import type { Preset } from '#/preset/index.js';
import { parseCardinality } from '#/references/cardinality.js';
import type { ValidationIssue } from '#/validation/index.js';
import { createError, createWarning } from '#/validation/index.js';
import { scenarioResourceReservedKeys } from './types.js';
import type { ScenarioDefinition } from './types.js';

/** Validates scenario aliases, bindings, and repeated field inputs. */
export function validateScenario(
	scenario: ScenarioDefinition,
	definitions: ResourceTypeDefinition[] = [],
	presets: Preset[] = [],
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const aliases = new Set<string>();
	const seenAliases = new Set<string>();
	const bindings = new Map<string, string>();
	const presetIndex = new Map(presets.map((preset) => [preset.id, preset]));
	const definitionIndex = new Map(definitions.map((definition) => [definition.resourceType, definition]));
	const bindingIndex = indexBindings(definitions);
	const generatorNames = new Set(getBuiltinGeneratorNames());

	if (!scenario.id) {
		issues.push(createError('scenario.missingId', 'Scenario is missing id.'));
	}
	if (!scenario.name) {
		issues.push(createError('scenario.missingName', 'Scenario is missing name.'));
	}
	if (!Array.isArray(scenario.resources)) {
		issues.push(createError('scenario.invalidResources', 'Scenario resources must be an array.'));
		return issues;
	}

	for (const resource of scenario.resources) {
		if (resource.alias) {
			aliases.add(resource.alias);
		}
	}

	for (const resource of scenario.resources) {
		if (!resource.alias) {
			issues.push(createError('scenario.missingAlias', 'Scenario resource is missing alias.'));
		}
		if (!resource.resourceType) {
			issues.push(createError('scenario.missingResourceType', `Resource "${resource.alias}" is missing resourceType.`));
		}
		if (seenAliases.has(resource.alias)) {
			issues.push(createError('scenario.duplicateAlias', `Duplicate resource alias "${resource.alias}".`));
		}
		seenAliases.add(resource.alias);

		const definition = definitionIndex.get(resource.resourceType);
		if (!definition) {
			issues.push(
				createError(
					'scenario.unknownResourceType',
					`Resource "${resource.alias}" uses unknown resource type "${resource.resourceType}".`,
				),
			);
		}
		const fieldIndex = new Map((definition?.fields ?? []).map((field) => [field.id, field]));
		for (const key of Object.keys(resource)) {
			if (!scenarioResourceReservedKeys.has(key)) {
				issues.push(
					createError(
						'scenario.unknownResourceProperty',
						`Resource "${resource.alias}" uses unknown property "${key}".`,
					),
				);
			}
		}

		if (resource.count !== undefined && (!Number.isInteger(resource.count) || resource.count < 1)) {
			issues.push(
				createError('scenario.invalidCount', `Resource "${resource.alias}" count must be a positive integer.`),
			);
		}

		if (resource.with !== undefined && !Array.isArray(resource.with)) {
			issues.push(createError('scenario.invalidWith', `Resource "${resource.alias}" with must be an array.`));
		}
		if (resource.as !== undefined && !Array.isArray(resource.as)) {
			issues.push(createError('scenario.invalidAs', `Resource "${resource.alias}" as must be an array.`));
		}
		if ('fields' in resource) {
			issues.push(createError('scenario.unsupportedFields', `Resource "${resource.alias}" must not use fields.`));
		}
		if (resource.inputs !== undefined && !isRecord(resource.inputs)) {
			issues.push(createError('scenario.invalidInputs', `Resource "${resource.alias}" inputs must be an object.`));
		}
		if (resource.references !== undefined && !isRecord(resource.references)) {
			issues.push(
				createError('scenario.invalidReferences', `Resource "${resource.alias}" references must be an object.`),
			);
		}

		for (const [fieldId, value] of fieldEntries(resource.inputs)) {
			issues.push(...validateGeneratorValue(value, generatorNames, resource.alias, fieldId));
		}

		for (const [fieldId, spec] of Object.entries(resource.references ?? {})) {
			const field = fieldIndex.get(fieldId);
			if (!field) {
				issues.push(
					createError(
						'scenario.unknownReferenceField',
						`Resource "${resource.alias}" references unknown field "${fieldId}".`,
					),
				);
				continue;
			}
			if (!field.reference) {
				issues.push(
					createError(
						'scenario.nonReferenceField',
						`Resource "${resource.alias}" field "${fieldId}" is not declared as a reference.`,
					),
				);
			}
			issues.push(...validateReferenceSpec(resource.alias, fieldId, spec, aliases, definitionIndex));
		}

		for (const presetId of Array.isArray(resource.with) ? resource.with : []) {
			const preset = presetIndex.get(presetId);
			if (!preset) {
				issues.push(
					createError('scenario.unknownPreset', `Resource "${resource.alias}" uses unknown preset "${presetId}".`),
				);
				continue;
			}
			if (preset.resourceType !== resource.resourceType) {
				issues.push(
					createError(
						'scenario.presetTypeMismatch',
						`Preset "${presetId}" cannot be applied to "${resource.resourceType}".`,
					),
				);
			}
			if (definition?.defaults?.with?.includes(presetId)) {
				issues.push(
					createWarning(
						'scenario.repeatedDefaultPreset',
						`Resource "${resource.alias}" repeats default preset "${presetId}".`,
					),
				);
			}
		}

		const localBindings = new Set<string>();
		for (const binding of Array.isArray(resource.as) ? resource.as : []) {
			if (localBindings.has(binding)) {
				issues.push(createError('scenario.duplicateBinding', `Duplicate binding "${binding}".`));
			}
			localBindings.add(binding);

			const bindingDefinition = bindingIndex.get(binding);
			if (!bindingDefinition) {
				issues.push(createError('scenario.unknownBinding', `Unknown binding "${binding}" on "${resource.alias}".`));
			} else if (!bindingDefinition.resourceTypes.includes(resource.resourceType)) {
				issues.push(
					createError(
						'scenario.bindingResourceTypeMismatch',
						`Binding "${binding}" does not allow resource type "${resource.resourceType}".`,
					),
				);
			}

			const previous = bindings.get(binding);
			if (previous) {
				issues.push(
					createError(
						'scenario.duplicateBinding',
						`Binding "${binding}" is bound by both "${previous}" and "${resource.alias}".`,
					),
				);
			}
			bindings.set(binding, resource.alias);
		}
	}

	return issues;
}

function validateGeneratorValue(
	value: unknown,
	generatorNames: Set<string>,
	alias: string,
	fieldId: string,
): ValidationIssue[] {
	const generatorName = readGeneratorName(value);
	if (generatorName && !generatorNames.has(generatorName)) {
		return [
			createError(
				'scenario.unknownGenerator',
				`Resource "${alias}" field "${fieldId}" uses unknown generator "${generatorName}".`,
			),
		];
	}

	return [];
}

function validateReferenceSpec(
	alias: string,
	fieldId: string,
	spec: unknown,
	aliases: Set<string>,
	definitions: Map<string, ResourceTypeDefinition>,
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];

	if (typeof spec === 'string') {
		if (!aliases.has(spec)) {
			issues.push(
				createError('scenario.unknownReferenceAlias', `Resource "${alias}" references unknown alias "${spec}".`),
			);
		}
		return issues;
	}

	if (!isRecord(spec)) {
		return [
			createError(
				'scenario.invalidReference',
				`Resource "${alias}" reference "${fieldId}" must be a string or object.`,
			),
		];
	}

	if ('alias' in spec) {
		if (typeof spec.alias !== 'string' || !aliases.has(spec.alias)) {
			issues.push(
				createError(
					'scenario.unknownReferenceAlias',
					`Resource "${alias}" reference "${fieldId}" uses unknown alias "${String(spec.alias)}".`,
				),
			);
		}
	} else if ('resourceType' in spec) {
		if (typeof spec.resourceType !== 'string' || !definitions.has(spec.resourceType)) {
			issues.push(
				createError(
					'scenario.unknownReferenceResourceType',
					`Resource "${alias}" reference "${fieldId}" selects unknown resource type "${String(spec.resourceType)}".`,
				),
			);
		}
		if ('strategy' in spec && !['first', 'one', 'sample'].includes(String(spec.strategy))) {
			issues.push(
				createError(
					'scenario.invalidReferenceStrategy',
					`Resource "${alias}" reference "${fieldId}" uses unknown strategy "${String(spec.strategy)}".`,
				),
			);
		}
	} else {
		issues.push(
			createError(
				'scenario.invalidReference',
				`Resource "${alias}" reference "${fieldId}" needs alias or resourceType.`,
			),
		);
	}

	if ('cardinality' in spec && typeof spec.cardinality === 'string') {
		try {
			parseCardinality(spec.cardinality);
		} catch {
			issues.push(
				createError(
					'scenario.invalidReferenceCardinality',
					`Resource "${alias}" reference "${fieldId}" has invalid cardinality "${spec.cardinality}".`,
				),
			);
		}
	}

	return issues;
}

function readGeneratorName(value: unknown): string | undefined {
	if (typeof value === 'string' && isGeneratorExpression(value)) {
		return parseExpression(value).name;
	}

	return undefined;
}

function fieldEntries(value: unknown): Array<[string, unknown]> {
	return isRecord(value) ? Object.entries(value) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function indexBindings(definitions: ResourceTypeDefinition[]): Map<string, { resourceTypes: string[] }> {
	const bindings = new Map<string, { resourceTypes: string[] }>();

	for (const definition of definitions) {
		for (const [bindingId, binding] of Object.entries(definition.bindings ?? {}) as Array<
			[string, ResourceBindingDefinition]
		>) {
			bindings.set(binding.key ?? `${definition.resourceType}.${bindingId}`, {
				resourceTypes: binding.resourceTypes,
			});
		}
	}

	return bindings;
}
