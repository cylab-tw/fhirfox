import type { ScenarioResolutionWarning } from './types.js';

/** Creates a scenario warning with optional alias and field context. */
export function warning(
	code: string,
	message: string,
	context: Omit<ScenarioResolutionWarning, 'code' | 'message'> = {},
): ScenarioResolutionWarning {
	return { code, message, ...context };
}
