export { createInMemoryDatasetProvider } from './provider/index.js';
export {
	createPresetJsonSchema,
	createResourceDefinitionJsonSchema,
	createScenarioJsonSchema,
} from './schema/index.js';
export { createValidationReport } from './validation/index.js';
export { compileResourceDefinitions } from './model/index.js';
export { resolveScenario } from './resolution/index.js';
export { validatePresets } from './preset/index.js';
export { validateResourceDefinitions } from './model/index.js';
export { validateScenario } from './scenario/index.js';
export {
	buildSourceAuthoringSchema,
	deriveResourceLinks,
	normalizeScenario,
	parseSourceFieldDocument,
} from './source.js';

export type { DatasetProvider, InMemoryDatasetProviderInput } from './provider/index.js';
export type {
	CompileResourceDefinitionsOptions,
	FieldDefinition,
	FieldReferenceDefinition,
	FieldValueType,
	GeneratorInput,
	ResourceDefinitionArtifact,
	ResourceBindingDefinition,
	ResourceTypeDefaults,
	ResourceTypeDefinition,
	SourceResource,
} from './model/index.js';
export type { Preset, PresetFieldValue, PresetRequirement } from './preset/index.js';
export type { ScenarioDefinition, ScenarioResourceDefinition } from './scenario/index.js';
export type {
	ResolvedScenario,
	ResolvedSourceResource,
	ResolveScenarioOptions,
	BindingCandidateExplanation,
	BindingResolutionExplanation,
	PresetResolutionExplanation,
	ResourceFieldProvenance,
	ResourceGraphEdge,
	ResourceGraphNode,
	ResourceRelationGraph,
	ResourceGraphTree,
	ResourceResolutionExplanation,
	ResolutionEvent,
	ScenarioResolutionMetadata,
	ScenarioResolutionExplanation,
	ScenarioResolutionWarning,
	SelectionResolutionExplanation,
} from './resolution/index.js';
export type { ValidationIssue, ValidationReport, ValidationSeverity } from './validation/index.js';
export type {
	Resource,
	ResourceLink,
	ScenarioLevel,
	ScenarioLevelDefinition,
	Scenario,
	ScenarioDocument,
	ScenarioMetadata,
	SourceAuthoringSchema,
	SourceFieldDocRecord,
	SourceResourceModel,
} from './source.js';
