/** Parsed `$ref(...)` or `$bindingRef(...)` expression used by presets. */
export interface ReferenceExpression {
	kind: 'ref' | 'bindingRef';
	value: string;
}

/** Reads a compact reference expression without evaluating it. */
export function readReferenceExpression(value: unknown): ReferenceExpression | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	const match = /^\$(ref|bindingRef)\(["']([^"']+)["']\)$/u.exec(value.trim());
	if (!match) {
		return undefined;
	}

	return {
		kind: match[1] as ReferenceExpression['kind'],
		value: match[2] ?? '',
	};
}
