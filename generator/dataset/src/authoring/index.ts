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
} from './contracts.js';

export { buildSourceAuthoringSchema, deriveResourceLinks, parseSourceFieldDocument } from './source-fields.js';
export { validateDatasetAuthoring } from './validate.js';
