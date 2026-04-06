import type { JsonViewerNodeContext } from '../types.ts';

/** Whether current row should render a trailing comma. */
export function hasTrailingComma(ctx: JsonViewerNodeContext): boolean {
	const { keyName, parentValue } = ctx;

	if (Array.isArray(parentValue) && typeof keyName === 'number') {
		return keyName < parentValue.length - 1;
	}

	if (!parentValue || typeof parentValue !== 'object' || Array.isArray(parentValue) || typeof keyName !== 'string') {
		return false;
	}

	const keys = Object.keys(parentValue as Record<string, unknown>);
	const idx = keys.indexOf(keyName);
	return idx !== -1 && idx < keys.length - 1;
}
