import type { SourceResource } from '#/model/index.js';

/** Runtime options for deterministic scenario resolution. */
export interface ResolveScenarioOptions {
	/** Seed used for repeatable ids, random choices, and selections. */
	seed: string;
	/** Clock value available to date/time defaults. */
	now?: Date;
	/** Timestamp written to resolution metadata. */
	generatedAt?: string;
	/** Include a resolver trace for authoring and debugging tools. */
	includeExplanation?: boolean;
}

/** Metadata copied from the scenario plus resolution run statistics. */
export interface ScenarioResolutionMetadata {
	scenarioId: string;
	scenarioName: string;
	summary?: string;
	details?: string;
	level?: number;
	scenarioType?: string;
	generatedAt: string;
	seed: string;
	stats: {
		resourceCount: number;
		explicitResourceCount: number;
		implicitResourceCount: number;
		relationCount: number;
		warningCount: number;
	};
}

/** Directed graph of generated or selected records and their relationships. */
export interface ResourceRelationGraph {
	nodes: ResourceGraphNode[];
	edges: ResourceGraphEdge[];
}

/** One generated or selected record in the relation graph. */
export interface ResourceGraphNode {
	/** Graph key, usually `<resourceType>/<id>`. */
	key: string;
	/** Scenario alias for the record. */
	alias: string;
	resourceType: string;
	/** Whether the scenario requested this record directly. */
	origin: 'explicit' | 'implicit';
	/** Whether the record was generated or selected from provider data. */
	materialization: 'generated' | 'selected' | 'provided';
	/** Preset ids applied while generating the record. */
	with: string[];
	/** Alias whose preset or reference required this record. */
	requiredBy?: string;
}

/** One relationship between resolved records. */
export interface ResourceGraphEdge {
	from: string;
	to: string;
	field: string;
	/** How the relationship was created. */
	relation: 'reference' | 'binding' | 'requires' | 'selected';
	cardinality?: string;
	reference?: {
		targetResourceType?: string;
		typeField?: string;
		typeValue?: string;
	};
}

/** Emitted source record plus resolver metadata. */
export interface ResolvedSourceResource {
	key: string;
	alias: string;
	resourceType: string;
	origin: 'explicit' | 'implicit';
	materialization: 'generated' | 'selected' | 'provided';
	resource: SourceResource;
	provenance: ResourceFieldProvenance[];
}

/** Reason a field value appears in a resolved source record. */
export interface ResourceFieldProvenance {
	field: string;
	source: 'preset' | 'scenarioInput' | 'reference' | 'generator' | 'selectedResource';
	/** Preset id, alias, or other source detail when available. */
	from?: string;
}

/** Non-fatal issue encountered during scenario resolution. */
export interface ScenarioResolutionWarning {
	code: string;
	message: string;
	path?: string;
	alias?: string;
	field?: string;
}

/** Optional resolution trace for scenario editors and debugging tools. */
export interface ScenarioResolutionExplanation {
	resources: ResourceResolutionExplanation[];
	bindings: BindingResolutionExplanation[];
	selections: SelectionResolutionExplanation[];
	events: ResolutionEvent[];
}

/** Why one record exists and which presets were considered or applied. */
export interface ResourceResolutionExplanation {
	alias: string;
	key: string;
	resourceType: string;
	origin: 'explicit' | 'implicit';
	materialization: 'generated' | 'selected' | 'provided';
	requiredBy?: string;
	presets: PresetResolutionExplanation[];
	fields: ResourceFieldProvenance[];
}

/** Preset selection detail for one record. */
export interface PresetResolutionExplanation {
	id: string;
	resourceType: string;
	source: 'available' | 'default' | 'scenario' | 'requirement';
	selected: boolean;
	reason: string;
}

/** How a binding requirement was matched to a scenario alias or generated record. */
export interface BindingResolutionExplanation {
	fromAlias: string;
	binding: string;
	bindingKey: string;
	targetResourceType: string;
	selectedAlias: string;
	source: 'scenarioBinding' | 'implicitRequirement';
	candidates: BindingCandidateExplanation[];
}

/** One alias considered while resolving a binding. */
export interface BindingCandidateExplanation {
	alias: string;
	resourceType: string;
	source: 'scenarioBinding' | 'implicitRequirement';
	selected: boolean;
}

/** Provider-backed reference selection detail for one field. */
export interface SelectionResolutionExplanation {
	fromAlias: string;
	field: string;
	resourceType: string;
	cardinality: string;
	strategy?: string;
	selectedKeys: string[];
}

/** Ordered event for explaining resolver decisions. */
export interface ResolutionEvent {
	code: string;
	message: string;
	alias?: string;
	field?: string;
}

/** Scenario resolution output consumed by UI, converter, and tests. */
export interface ResolvedScenario {
	metadata: ScenarioResolutionMetadata;
	graph: ResourceRelationGraph;
	resources: ResolvedSourceResource[];
	warnings: ScenarioResolutionWarning[];
	explanation?: ScenarioResolutionExplanation;
}
