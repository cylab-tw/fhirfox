export { compileResourceDefinitions } from './compile.js';
export { getFieldDefinition, getResourceDefinition } from './lookup.js';
export { indexFields, indexResourceDefinitions } from './normalize.js';
export { validateResourceDefinitions } from './validate.js';

export type {
	CompileResourceDefinitionsOptions,
	CodeMappingDefinition,
	FieldDefaultValue,
	FieldDefinition,
	FieldReferenceDefinition,
	FieldValueType,
	GeneratorInput,
	ResourceBindingDefinition,
	ResourceDefinitionArtifact,
	ResourceTypeDefaults,
	ResourceTypeDefinition,
	SourceResource,
} from './types.js';
