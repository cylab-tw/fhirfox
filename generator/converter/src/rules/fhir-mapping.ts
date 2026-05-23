import type { GeneratorRuleRow } from '../types.js';

export interface DetermineFhirMappingOptions {
	igName: string;
	igVersion: string;
	resourceType: string;
	sourceColumn: string;
}

export function determineFhirMappingFromGeneratorRules(
	rules: GeneratorRuleRow[],
	options: DetermineFhirMappingOptions,
): string | undefined {
	const paths = rules
		.filter(
			(rule) =>
				rule.isActive &&
				rule.igName === options.igName &&
				rule.igVersion === options.igVersion &&
				rule.resourceType.toLowerCase() === options.resourceType.toLowerCase() &&
				rule.sourceColumn === options.sourceColumn,
		)
		.sort((left, right) => left.sortOrder - right.sortOrder)
		.map((rule) => rule.fhirPath);
	const uniquePaths = [...new Set(paths)];

	return uniquePaths.length > 0 ? uniquePaths.join(', ') : undefined;
}
