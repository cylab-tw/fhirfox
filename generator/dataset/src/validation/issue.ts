/** Validation severity for dataset authoring diagnostics. */
export type ValidationSeverity = 'error' | 'warning';

/** Machine-readable validation issue with a human-readable message. */
export interface ValidationIssue {
	severity: ValidationSeverity;
	code: string;
	message: string;
	path?: string;
}

/** Creates an issue that should block use of the dataset file. */
export function createError(code: string, message: string, path?: string): ValidationIssue {
	return { severity: 'error', code, message, path };
}

/** Creates an issue that should be shown but does not block generation. */
export function createWarning(code: string, message: string, path?: string): ValidationIssue {
	return { severity: 'warning', code, message, path };
}
