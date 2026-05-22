export interface ConvertOptions {
	igName: string;
	igVersion: string;
	fullUrlBase?: string;
}

export type TransformKind = 'copy' | 'code_map' | 'build_reference';

export interface SourceResource {
	id: string;
	__resourceType?: string;
	resourceType?: string;
	type?: string;
	[key: string]: unknown;
}

export interface GeneratorRuleRow {
	igName: string;
	igVersion: string;
	resourceType: string;
	sourceColumn: string;
	fhirPath: string;
	dataType: string;
	isRequired: boolean;
	transformKind: TransformKind;
	mappingKey?: string;
	referenceTarget?: string;
	sortOrder: number;
	isActive: boolean;
}

export interface ResourceProfileRow {
	igName: string;
	igVersion: string;
	resourceType: string;
	profileUrl: string;
	isActive: boolean;
}

export interface CodeMappingRow {
	mappingKey: string;
	sourceCode: string;
	targetCode: string;
	targetDisplay?: string;
	targetSystem: string;
	displayZhTw?: string;
	isActive: boolean;
}

export interface FhirCodingMapping {
	code: string;
	display?: string;
	system: string;
	displayZhTw?: string;
}

export interface StaticConverterRows {
	generatorRules: GeneratorRuleRow[];
	resourceProfiles: ResourceProfileRow[];
	codeMappings: CodeMappingRow[];
}

export interface ConverterRuleSet {
	generatorRulesByResourceType: Map<string, GeneratorRuleRow[]>;
	resourceProfilesByResourceType: Map<string, ResourceProfileRow>;
	codeMappingsByKey: Map<string, Map<string, CodeMappingRow[]>>;
	sourceFieldOrder?: Record<string, string[]>;
}

export interface StaticConverterServiceOptions {
	baseDir: string;
}

export interface FhirResource {
	resourceType: string;
	id?: string;
	__sourceId?: string;
	meta?: {
		profile?: string[];
		[key: string]: unknown;
	};
	[key: string]: unknown;
}

export interface FhirBundleEntry {
	fullUrl?: string;
	resource: FhirResource;
}

export interface FhirBundle {
	resourceType: 'Bundle';
	type: 'collection';
	entry: FhirBundleEntry[];
}

export interface ConverterService {
	toFhirResource(input: SourceResource, options: ConvertOptions): Promise<FhirResource>;
	toFhirBundle(inputs: SourceResource[], options: ConvertOptions): Promise<FhirBundle>;
}
