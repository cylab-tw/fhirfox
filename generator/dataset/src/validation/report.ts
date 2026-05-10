import type { ValidationIssue } from './issue.js';

/** Validation issues with aggregate error and warning counts. */
export interface ValidationReport {
	issues: ValidationIssue[];
	errorCount: number;
	warningCount: number;
}

/** Builds a collection of validation issues. */
export function createValidationReport(issues: ValidationIssue[]): ValidationReport {
	return {
		issues,
		errorCount: issues.filter((issue) => issue.severity === 'error').length,
		warningCount: issues.filter((issue) => issue.severity === 'warning').length,
	};
}
