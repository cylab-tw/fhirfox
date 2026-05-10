import { applyInput, applyPresetField, createFieldPlans } from './precedence.js';
import {
	createDefaultGeneratorRegistry,
	evaluateGenerator,
	evaluateValue,
	isGeneratorExpression,
} from '#/generators/index.js';
import { getFieldDefinition } from '#/model/index.js';
import { provenance } from './provenance.js';

import type { ResourceTypeDefinition, SourceResource } from '#/model/index.js';
import type { Preset } from '#/preset/index.js';
import type { ResolutionContext } from './context.js';
import type { ResourceFieldProvenance } from './types.js';
import type { ScenarioResourceDefinition } from '#/scenario/index.js';

/** Inputs needed to emit one scenario resource as source JSON. */
export interface MaterializeInput {
	resource: ScenarioResourceDefinition;
	definition: ResourceTypeDefinition;
	presets: Preset[];
	context: ResolutionContext;
	ref(alias: string): string | undefined;
	bindingRef(binding: string): string | undefined;
}

/** Emitted source record plus field provenance. */
export interface MaterializedResource {
	resource: SourceResource;
	provenance: ResourceFieldProvenance[];
}

/** Applies defaults, presets, scenario fields, and inputs to emit one source record. */
export function materializeResource(input: MaterializeInput): MaterializedResource {
	const registry = createDefaultGeneratorRegistry();
	const plans = createFieldPlans(input.definition.fields);
	const provenanceEntries: ResourceFieldProvenance[] = [];
	const values: Record<string, unknown> = {};

	for (const preset of input.presets) {
		for (const [field, value] of Object.entries(preset.fields ?? {})) {
			const plan = plans.get(field);
			if (plan) {
				plans.set(field, applyPresetField(plan, value, preset.id));
				provenanceEntries.push(provenance(field, 'preset', preset.id));
			}
		}
	}

	for (const [field, value] of Object.entries(input.resource.inputs ?? {})) {
		const plan = plans.get(field);
		if (plan) {
			plans.set(field, applyInput(plan, value));
			provenanceEntries.push(provenance(field, 'scenarioInput'));
		}
	}

	const generatorContext = {
		seed: input.context.options.seed,
		now: input.context.options.now,
		resourceType: input.definition.resourceType,
		alias: input.resource.alias,
		inputs: input.resource.inputs ?? {},
		values,
		nextId: (resourceType: string) => input.context.nextId(resourceType),
		random: (key: string) => input.context.random(`${input.resource.alias}:${key}`),
		ref: input.ref,
		bindingRef: input.bindingRef,
	};

	for (const [field, plan] of plans) {
		const fieldContext = {
			...generatorContext,
			field,
		};

		if (plan.value !== undefined) {
			values[field] = evaluateValue(plan.value, fieldContext, registry);
			if (isGeneratorExpression(plan.value)) {
				provenanceEntries.push(provenance(field, 'generator', plan.from));
			}
			continue;
		}

		if (plan.default !== undefined) {
			if (typeof plan.default === 'string' && isGeneratorExpression(plan.default)) {
				const generatorInput = plan.input ? [plan.input] : [];
				const generatedValue = evaluateGenerator(plan.default, generatorInput, fieldContext, registry);
				if (generatedValue !== undefined) {
					values[field] = generatedValue;
				}
				provenanceEntries.push(provenance(field, 'generator', plan.from));
			} else {
				values[field] = plan.default;
			}
		}
	}

	values.id ??= input.context.nextId(input.definition.resourceType);

	const emitted = orderResourceFields(
		Object.fromEntries(
			Object.entries(values).filter(([field]) => getFieldDefinition(input.definition, field)?.emit !== false),
		),
		input.definition,
	) as SourceResource;
	emitted.id = String(values.id);

	return {
		resource: emitted,
		provenance: provenanceEntries,
	};
}

/** Returns a source record whose enumerable fields follow the resource definition order. */
export function orderResourceFields(
	resource: Record<string, unknown>,
	definition: ResourceTypeDefinition,
): SourceResource {
	const ordered: Record<string, unknown> = {};

	for (const field of definition.fields) {
		if (field.emit === false || !(field.id in resource)) {
			continue;
		}

		ordered[field.id] = resource[field.id];
	}

	for (const [field, value] of Object.entries(resource)) {
		if (!(field in ordered)) {
			ordered[field] = value;
		}
	}

	return ordered as SourceResource;
}
