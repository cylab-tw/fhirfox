import type { ResourceType } from '../resources/index.js';

export interface SourceFieldDocRecord {
	description: string;
	cardinality: string;
	required: boolean;
	fhirMapping?: string;
	reference?: ResourceType | ResourceType[];
}

export interface SourceResourceModel {
	resourceType: ResourceType;
	description: string;
	cardinality: string;
	fields: Record<string, SourceFieldDocRecord>;
	order: string[];
}

export interface SourceAuthoringSchema {
	models: Record<ResourceType, SourceResourceModel>;
	docs: Record<string, SourceFieldDocRecord>;
	order: Record<string, string[]>;
}

export interface AuthoredSourceResource {
	path: string;
	resourceType: ResourceType;
	value: Record<string, unknown>;
}

export interface AuthoredScenarioDocument {
	path: string;
	document: Record<string, unknown>;
}

export interface AuthoredLinkRecord {
	path: string;
	sourceType: ResourceType;
	field: string;
	targetTypes: ResourceType[];
}

export interface CodeMappingRecord {
	path: string;
	mappingKey: string;
	sourceCode: string;
	targetCode: string;
	targetSystem: string;
	targetDisplay?: string;
}

export interface GeneratorRuleMappingRecord {
	path: string;
	resourceType: ResourceType;
	sourceColumn: string;
	mappingKey?: string;
}

export type DatasetValidationSeverity = 'error' | 'warning';

export interface DatasetValidationIssue {
	severity: DatasetValidationSeverity;
	code: string;
	path: string;
	message: string;
	help?: string;
}

export interface DatasetValidationReport {
	issues: DatasetValidationIssue[];
	errorCount: number;
	warningCount: number;
}

export interface DatasetAuthoringInput {
	schema: SourceAuthoringSchema;
	resources: AuthoredSourceResource[];
	scenarios: AuthoredScenarioDocument[];
	links?: AuthoredLinkRecord[];
	codeMappings: CodeMappingRecord[];
	generatorRuleMappings: GeneratorRuleMappingRecord[];
}
