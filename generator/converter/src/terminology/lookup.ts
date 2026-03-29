import type { ConverterRuleSet, FhirCodingMapping } from '../types.js';

/**
 * Resolves one source code into its FHIR coding mapping.
 */
export function resolveCodeMapping(
	ruleSet: ConverterRuleSet,
	mappingKey: string,
	sourceCode: string,
): FhirCodingMapping {
	const mappingsBySourceCode = ruleSet.codeMappingsByKey.get(mappingKey);

	if (!mappingsBySourceCode) {
		throw new Error(`Missing code mapping group "${mappingKey}".`);
	}

	const matches = mappingsBySourceCode.get(sourceCode);

	if (!matches || matches.length === 0) {
		throw new Error(`Missing code mapping for "${mappingKey}" source code "${sourceCode}".`);
	}

	const match = matches[0];

	return {
		code: match.targetCode,
		display: match.targetDisplay,
		system: match.targetSystem,
		displayZhTw: match.displayZhTw,
	};
}
