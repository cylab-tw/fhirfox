export type TransformKind = 'copy' | 'code_map' | 'build_reference';

export interface GeneratorRule {
	igName: string;
	igVersion: string;
	resourceType: string;
	sourceTable: string;
	sourceColumn: string;
	fhirPath: string;
	dataType: string;
	isRequired: boolean;
	transformKind: TransformKind;
	mappingKey: string | null;
	referenceTarget: string | null;
	sortOrder: number;
}

export interface ResourceProfile {
	igName: string;
	igVersion: string;
	resourceType: string;
	profileUrl: string;
}

export interface CodeMapping {
	mappingKey: string;
	sourceCode: string;
	targetCode: string;
	targetDisplay: string | null;
	targetSystem: string;
	displayZhTw: string | null;
	groupName: string | null;
}

export type GeneratorValue = string | boolean;

export type SourceRow = Record<string, GeneratorValue | undefined>;

export interface SourceRecord {
	resourceType: string;
	logicalId: string;
	tables: Record<string, SourceRow[]>;
}

export interface FhirResource {
	resourceType: string;
	id?: string;
	[key: string]: unknown;
}
