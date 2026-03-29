export type { DatasetProvider } from './providers/index.js';

export type { Dataset, Resource, ResourceType, ResourceLink, ResourceLinks } from './resources/index.js';
export type {
	AuthoredLinkRecord,
	AuthoredScenarioDocument,
	AuthoredSourceResource,
	CodeMappingRecord,
	DatasetValidationIssue,
	DatasetValidationReport,
	DatasetValidationSeverity,
	DatasetAuthoringInput,
	GeneratorRuleMappingRecord,
	SourceAuthoringSchema,
	SourceFieldDocRecord,
	SourceResourceModel,
} from './authoring/index.js';

export type {
	ResolvedScenario,
	Scenario,
	ScenarioDocument,
	ScenarioLevel,
	ScenarioLevelDefinition,
	ScenarioMetadata,
	ScenarioResourceSelection,
	ScenarioService,
} from './scenario/index.js';

export {
	normalizeScenario,
	createScenarioService,
	resolveScenario,
	getScenarioLevelDefinition,
	SCENARIO_LEVEL_DEFINITIONS,
	SCENARIO_RESOURCE_KEYS,
	validateScenarioDocument,
} from './scenario/index.js';
export {
	buildSourceAuthoringSchema,
	deriveResourceLinks,
	parseSourceFieldDocument,
	validateDatasetAuthoring,
} from './authoring/index.js';
