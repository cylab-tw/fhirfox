import { validateResourceDefinitions } from './validate.js';

import type { CompileResourceDefinitionsOptions, ResourceDefinitionArtifact } from './types.js';

/** Validates loaded resource type definitions. */
export function compileResourceDefinitions(options: CompileResourceDefinitionsOptions): ResourceDefinitionArtifact {
	return {
		resourceTypeDefinitions: options.definitions,
		issues: validateResourceDefinitions(options.definitions),
	};
}
