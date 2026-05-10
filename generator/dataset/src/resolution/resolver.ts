/* eslint-disable sort-imports */
import { createResolutionContext } from './context.js';
import { createGraph, orderGraphKeys } from './graph.js';
import { materializeResource, orderResourceFields } from './materialize.js';
import { getResourceDefinition, indexFields, indexResourceDefinitions } from '#/model/index.js';
import { readReferenceExpression } from '#/generators/index.js';
import { indexPresets } from '#/preset/index.js';
import { referenceValue, resolveReference } from '#/references/index.js';
import { normalizeScenario } from '#/scenario/index.js';

import type {
	BindingResolutionExplanation,
	PresetResolutionExplanation,
	ResolveScenarioOptions,
	ResolvedScenario,
	ResolvedSourceResource,
	ResourceGraphEdge,
	ResourceGraphNode,
	ResourceResolutionExplanation,
	ScenarioResolutionMetadata,
	ScenarioResolutionWarning,
	SelectionResolutionExplanation,
} from './types.js';
import type { ResourceTypeDefinition } from '#/model/index.js';
import type { Preset, PresetRequirement } from '#/preset/index.js';
import type { DatasetProvider } from '#/provider/index.js';
import type { ReferenceSpec } from '#/references/index.js';
import type { ScenarioDefinition, ScenarioResourceDefinition } from '#/scenario/index.js';

interface WorkItem {
	resource: ScenarioResourceDefinition;
	origin: 'explicit' | 'implicit';
	requiredBy?: string;
	withSources?: Map<string, AppliedPresetSource>;
}

type AppliedPresetSource = 'default' | 'scenario' | 'requirement';
type BindingAliasSource = 'scenarioBinding' | 'implicitRequirement';

interface AppliedPreset {
	id: string;
	source: AppliedPresetSource;
}

interface BindingAlias {
	alias: string;
	source: BindingAliasSource;
}

interface ExpandedWorkItems {
	items: WorkItem[];
	bindings: BindingResolutionExplanation[];
}

/** Resolves a scenario into metadata, a relation graph, and emitted source records. */
export async function resolveScenario(
	provider: DatasetProvider,
	scenarioInput: ScenarioDefinition,
	options: ResolveScenarioOptions,
): Promise<ResolvedScenario> {
	const context = createResolutionContext(options);
	const scenario = normalizeScenario(scenarioInput);
	const definitions = indexResourceDefinitions(await provider.getResourceTypeDefinitions());
	const presetIndex = indexPresets(await provider.getPresets());
	const bindingAliases = collectScenarioBindingAliases(scenario.resources);
	const expanded = expandImplicitResources(
		scenario.resources.map((resource) => ({ resource, origin: 'explicit' })),
		definitions,
		presetIndex,
		bindingAliases,
	);
	const items = expanded.items;
	const resolved = new Map<string, ResolvedSourceResource>();
	const nodes: ResourceGraphNode[] = [];
	const edges: ResourceGraphEdge[] = [];
	const warnings: ScenarioResolutionWarning[] = [];
	const resourceExplanations: ResourceResolutionExplanation[] = [];
	const selectionExplanations: SelectionResolutionExplanation[] = [];
	const includeExplanation = options.includeExplanation === true;

	for (const item of items) {
		const definition = getResourceDefinition(definitions, item.resource.resourceType);
		const appliedPresets = getAppliedPresets(definition, item);
		const presetIds = appliedPresets.map((preset) => preset.id);
		const presets = readPresets(presetIds, presetIndex, item.resource.resourceType);
		warnings.push(...findPresetCollisionWarnings(presets, item.resource.alias, item.resource.resourceType));
		const materialized = materializeResource({
			resource: item.resource,
			definition,
			presets,
			context,
			ref: (alias) => resolved.get(alias)?.resource.id,
			bindingRef: (binding) => {
				const bindingAlias = bindingAliases.get(bindingKey(definition, binding));
				return bindingAlias ? resolved.get(bindingAlias.alias)?.resource.id : undefined;
			},
		});
		const key = `${item.resource.resourceType}/${materialized.resource.id}`;

		resolved.set(item.resource.alias, {
			key,
			alias: item.resource.alias,
			resourceType: item.resource.resourceType,
			origin: item.origin,
			materialization: 'generated',
			resource: materialized.resource,
			provenance: materialized.provenance,
		});

		nodes.push({
			key,
			alias: item.resource.alias,
			resourceType: item.resource.resourceType,
			origin: item.origin,
			materialization: 'generated',
			with: presetIds,
			requiredBy: item.requiredBy,
		});

		if (includeExplanation) {
			resourceExplanations.push({
				key,
				alias: item.resource.alias,
				resourceType: item.resource.resourceType,
				origin: item.origin,
				materialization: 'generated',
				requiredBy: item.requiredBy,
				presets: explainPresets(appliedPresets, item.resource.resourceType, presetIndex),
				fields: materialized.provenance,
			});
		}
	}

	for (const item of items) {
		const current = resolved.get(item.resource.alias);
		if (!current) {
			continue;
		}

		const definition = getResourceDefinition(definitions, item.resource.resourceType);
		const fieldIndex = indexFields(definition);
		const presets = readPresets(
			getAppliedPresets(definition, item).map((preset) => preset.id),
			presetIndex,
			item.resource.resourceType,
		);
		for (const preset of presets) {
			for (const [field, value] of Object.entries(preset.fields ?? {})) {
				const expression = readReferenceExpression(
					typeof value === 'object' && value !== null && 'value' in value ? value.value : value,
				);
				const alias = expression?.kind === 'ref' ? expression.value : undefined;
				const binding = expression?.kind === 'bindingRef' ? expression.value : undefined;
				const bindingAlias = binding ? bindingAliases.get(bindingKey(definition, binding))?.alias : undefined;
				const target = alias ? resolved.get(alias) : bindingAlias ? resolved.get(bindingAlias) : undefined;
				if (!target) {
					continue;
				}
				current.resource[field] = target.resource.id;
				edges.push({
					from: current.key,
					to: target.key,
					field,
					relation: 'requires',
					cardinality: '1..1',
					reference: {
						targetResourceType: target.resourceType,
					},
				});
			}
		}
		for (const field of definition.fields) {
			const binding = field.reference?.binding;
			if (!binding || item.resource.references?.[field.id] !== undefined || current.resource[field.id] !== undefined) {
				continue;
			}
			const bindingAlias = bindingAliases.get(bindingKey(definition, binding))?.alias;
			const target = bindingAlias ? resolved.get(bindingAlias) : undefined;
			if (!target) {
				continue;
			}
			current.resource[field.id] = target.resource.id;
			current.provenance.push({ field: field.id, source: 'reference', from: `binding:${binding}` });
			edges.push({
				from: current.key,
				to: target.key,
				field: field.id,
				relation: 'binding',
				cardinality: '1..1',
				reference: {
					targetResourceType: target.resourceType,
				},
			});
		}
		for (const [field, spec] of Object.entries(item.resource.references ?? {})) {
			const reference = await resolveReference(field, resolveSelectAliases(spec, resolved), {
				getField: (fieldId) => fieldIndex.get(fieldId),
				getResource: (alias) => {
					const target = resolved.get(alias);
					return target ? { key: target.key, id: target.resource.id, resourceType: target.resourceType } : undefined;
				},
				query: provider.queryResources.bind(provider),
				seed: options.seed,
			});

			const value = referenceValue(reference);
			if (value !== undefined) {
				current.resource[field] = value;
			}
			if (reference.typeField && reference.typeValue) {
				current.resource[reference.typeField] = reference.typeValue;
			}
			for (const selected of reference.selectedResources ?? []) {
				if ([...resolved.values()].some((resource) => resource.key === selected.key)) {
					continue;
				}
				const alias = `${item.resource.alias}.${field}.${selected.resource.id}`;
				resolved.set(alias, {
					key: selected.key,
					alias,
					resourceType: selected.resourceType,
					origin: 'implicit',
					materialization: 'selected',
					resource: selected.resource,
					provenance: [{ field: '*', source: 'selectedResource', from: item.resource.alias }],
				});
				nodes.push({
					key: selected.key,
					alias,
					resourceType: selected.resourceType,
					origin: 'implicit',
					materialization: 'selected',
					with: [],
					requiredBy: item.resource.alias,
				});
				if (includeExplanation) {
					resourceExplanations.push({
						key: selected.key,
						alias,
						resourceType: selected.resourceType,
						origin: 'implicit',
						materialization: 'selected',
						requiredBy: item.resource.alias,
						presets: explainPresets([], selected.resourceType, presetIndex),
						fields: [{ field: '*', source: 'selectedResource', from: item.resource.alias }],
					});
				}
			}
			if (includeExplanation && reference.selectedResources && typeof spec !== 'string' && 'resourceType' in spec) {
				selectionExplanations.push({
					fromAlias: item.resource.alias,
					field,
					resourceType: spec.resourceType,
					cardinality: reference.cardinality,
					strategy: spec.strategy,
					selectedKeys: reference.targetKeys,
				});
			}
			edges.push(
				...reference.targetKeys.map((to) => ({
					from: current.key,
					to,
					field,
					relation: reference.selectedResources ? ('selected' as const) : ('reference' as const),
					cardinality: reference.cardinality,
					reference: {
						targetResourceType: reference.targetResourceType,
						typeField: reference.typeField,
						typeValue: reference.typeValue,
					},
				})),
			);
		}
	}

	const graph = createGraph(nodes, edges);
	const graphOrder = orderGraphKeys(nodes, edges);
	const resourcesByKey = new Map([...resolved.values()].map((resource) => [resource.key, resource]));
	const resources = graphOrder.flatMap((key) => {
		const resource = resourcesByKey.get(key);
		if (!resource) {
			return [];
		}
		const definition = getResourceDefinition(definitions, resource.resourceType);
		return [
			{
				...resource,
				resource: orderResourceFields(resource.resource, definition),
			},
		];
	});
	const metadata = createMetadata(scenario, context.options.generatedAt, options.seed, resources, edges, warnings);

	const output: ResolvedScenario = {
		metadata,
		graph,
		resources,
		warnings,
	};

	if (includeExplanation) {
		output.explanation = {
			resources: resourceExplanations,
			bindings: expanded.bindings,
			selections: selectionExplanations,
			events: [
				{
					code: 'scenario.resolved',
					message: `Resolved scenario "${scenario.id}" with ${resources.length} resources and ${edges.length} relations.`,
				},
			],
		};
	}

	return output;
}

function createMetadata(
	scenario: ReturnType<typeof normalizeScenario>,
	generatedAt: string,
	seed: string,
	resources: ResolvedSourceResource[],
	edges: ResourceGraphEdge[],
	warnings: ScenarioResolutionWarning[],
): ScenarioResolutionMetadata {
	return {
		scenarioId: scenario.id,
		scenarioName: scenario.name,
		summary: scenario.summary,
		details: scenario.details,
		level: scenario.level,
		scenarioType: scenario.scenarioType,
		generatedAt,
		seed,
		stats: {
			resourceCount: resources.length,
			explicitResourceCount: resources.filter((resource) => resource.origin === 'explicit').length,
			implicitResourceCount: resources.filter((resource) => resource.origin === 'implicit').length,
			relationCount: edges.length,
			warningCount: warnings.length,
		},
	};
}

function getAppliedPresets(definition: ResourceTypeDefinition, item: WorkItem): AppliedPreset[] {
	return [
		...(definition.defaults?.with ?? []).map((id) => ({ id, source: 'default' as const })),
		...(item.resource.with ?? []).map((id) => ({
			id,
			source: item.withSources?.get(id) ?? ('scenario' as const),
		})),
	];
}

function explainPresets(
	appliedPresets: AppliedPreset[],
	resourceType: string,
	presetIndex: Map<string, Preset>,
): PresetResolutionExplanation[] {
	const applied = new Map(appliedPresets.map((preset) => [preset.id, preset.source]));
	const explanations: PresetResolutionExplanation[] = [];

	for (const preset of presetIndex.values()) {
		if (preset.resourceType !== resourceType) {
			continue;
		}

		const source = applied.get(preset.id);
		explanations.push({
			id: preset.id,
			resourceType,
			source: source ?? 'available',
			selected: source !== undefined,
			reason: source ? presetReason(source) : 'Available for this resource type but not selected.',
		});
	}

	return explanations.sort(
		(left, right) => Number(right.selected) - Number(left.selected) || left.id.localeCompare(right.id),
	);
}

function presetReason(source: AppliedPresetSource): string {
	if (source === 'default') {
		return 'Selected from resource type defaults.';
	}
	if (source === 'requirement') {
		return 'Selected by an implicit resource requirement.';
	}
	return 'Selected by scenario resource authoring.';
}

function collectScenarioBindingAliases(resources: ScenarioResourceDefinition[]): Map<string, BindingAlias> {
	const aliases = new Map<string, BindingAlias>();

	for (const resource of resources) {
		for (const key of resource.as ?? []) {
			aliases.set(key, {
				alias: resource.alias,
				source: 'scenarioBinding',
			});
		}
	}

	return aliases;
}

function resolveSelectAliases(spec: ReferenceSpec, resolved: Map<string, ResolvedSourceResource>): ReferenceSpec {
	if (typeof spec === 'string' || !spec.select) {
		return spec;
	}

	return {
		...spec,
		select: Object.fromEntries(
			Object.entries(spec.select).map(([field, value]) => [
				field,
				typeof value === 'string' ? (resolved.get(value)?.resource.id ?? value) : value,
			]),
		),
	};
}

function expandImplicitResources(
	items: WorkItem[],
	definitions: Map<string, ResourceTypeDefinition>,
	presets: Map<string, Preset>,
	bindingAliases: Map<string, BindingAlias>,
): ExpandedWorkItems {
	const output = [...items];
	const aliases = new Set(output.map((item) => item.resource.alias));
	const bindings: BindingResolutionExplanation[] = [];

	for (const item of output) {
		const definition = getResourceDefinition(definitions, item.resource.resourceType);
		for (const presetId of getAppliedPresets(definition, item).map((preset) => preset.id)) {
			const preset = presets.get(presetId);
			for (const requirement of preset?.requires ?? []) {
				const resolvedRequirement = resolveRequirement(definition, requirement, bindingAliases);
				if (!resolvedRequirement) {
					continue;
				}
				if (resolvedRequirement.binding && resolvedRequirement.bindingKey) {
					bindings.push({
						fromAlias: item.resource.alias,
						binding: resolvedRequirement.binding,
						bindingKey: resolvedRequirement.bindingKey,
						targetResourceType: resolvedRequirement.resourceType,
						selectedAlias: resolvedRequirement.alias,
						source: resolvedRequirement.source,
						candidates: [
							{
								alias: resolvedRequirement.alias,
								resourceType: resolvedRequirement.resourceType,
								source: resolvedRequirement.source,
								selected: true,
							},
						],
					});
				}
				if (aliases.has(resolvedRequirement.alias)) {
					continue;
				}
				aliases.add(resolvedRequirement.alias);
				output.push({
					origin: 'implicit',
					requiredBy: item.resource.alias,
					withSources: new Map((requirement.with ?? []).map((id) => [id, 'requirement' as const])),
					resource: {
						alias: resolvedRequirement.alias,
						resourceType: resolvedRequirement.resourceType,
						with: requirement.with ?? [],
					},
				});
			}
		}
		for (const field of definition.fields) {
			const binding = field.reference?.binding;
			if (!binding || item.resource.references?.[field.id] !== undefined) {
				continue;
			}
			const resolvedRequirement = resolveBindingRequirement(definition, binding, bindingAliases);
			if (!resolvedRequirement) {
				continue;
			}
			bindings.push({
				fromAlias: item.resource.alias,
				binding: resolvedRequirement.binding,
				bindingKey: resolvedRequirement.bindingKey,
				targetResourceType: resolvedRequirement.resourceType,
				selectedAlias: resolvedRequirement.alias,
				source: resolvedRequirement.source,
				candidates: [
					{
						alias: resolvedRequirement.alias,
						resourceType: resolvedRequirement.resourceType,
						source: resolvedRequirement.source,
						selected: true,
					},
				],
			});
			if (aliases.has(resolvedRequirement.alias)) {
				continue;
			}
			aliases.add(resolvedRequirement.alias);
			output.push({
				origin: 'implicit',
				requiredBy: item.resource.alias,
				withSources: new Map(),
				resource: {
					alias: resolvedRequirement.alias,
					resourceType: resolvedRequirement.resourceType,
					with: [],
				},
			});
		}
	}

	return { items: output, bindings };
}

function resolveRequirement(
	definition: ResourceTypeDefinition,
	requirement: PresetRequirement,
	bindingAliases: Map<string, BindingAlias>,
):
	| {
			alias: string;
			resourceType: string;
			source: BindingAliasSource;
			binding?: string;
			bindingKey?: string;
	  }
	| undefined {
	if ('binding' in requirement) {
		return resolveBindingRequirement(definition, requirement.binding, bindingAliases);
	}

	return requirement.alias && requirement.resourceType
		? { alias: requirement.alias, resourceType: requirement.resourceType, source: 'implicitRequirement' }
		: undefined;
}

function resolveBindingRequirement(
	definition: ResourceTypeDefinition,
	bindingId: string,
	bindingAliases: Map<string, BindingAlias>,
):
	| {
			alias: string;
			resourceType: string;
			source: BindingAliasSource;
			binding: string;
			bindingKey: string;
	  }
	| undefined {
	const binding = definition.bindings?.[bindingId];
	if (!binding) {
		return undefined;
	}

	const key = bindingKey(definition, bindingId);
	const bindingResourceType = binding.resourceTypes[0] ?? definition.resourceType;
	const existing = bindingAliases.get(key);
	if (existing) {
		return {
			alias: existing.alias,
			resourceType: bindingResourceType,
			source: existing.source,
			binding: bindingId,
			bindingKey: key,
		};
	}

	const alias = key;
	bindingAliases.set(key, {
		alias,
		source: 'implicitRequirement',
	});
	return {
		alias,
		resourceType: bindingResourceType,
		source: 'implicitRequirement',
		binding: bindingId,
		bindingKey: key,
	};
}

function bindingKey(definition: ResourceTypeDefinition, bindingId: string): string {
	return definition.bindings?.[bindingId]?.key ?? `${definition.resourceType}.${bindingId}`;
}

function readPresets(ids: string[], presets: Map<string, Preset>, resourceType: string): Preset[] {
	return ids.map((id) => {
		const preset = presets.get(id);
		if (!preset) {
			throw new Error(`Unknown preset "${id}".`);
		}
		if (preset.resourceType !== resourceType) {
			throw new Error(`Preset "${id}" cannot be applied to "${resourceType}".`);
		}
		return preset;
	});
}

function findPresetCollisionWarnings(
	presets: Preset[],
	alias: string,
	resourceType: string,
): ScenarioResolutionWarning[] {
	const warnings: ScenarioResolutionWarning[] = [];
	const fields = new Map<string, string>();

	for (const preset of presets) {
		for (const field of Object.keys(preset.fields ?? {})) {
			const previous = fields.get(field);
			if (previous && !preset.overrides?.includes(field)) {
				warnings.push({
					code: 'preset.fieldCollision',
					message: `Preset "${preset.id}" overrides field "${field}" from "${previous}" on "${resourceType}".`,
					alias,
					field,
				});
			}
			fields.set(field, preset.id);
		}
	}

	return warnings;
}
