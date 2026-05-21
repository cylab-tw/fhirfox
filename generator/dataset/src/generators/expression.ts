import type { ParsedExpression } from './types.js';

/** Returns true when a value uses `$name(...)` expression syntax. */
export function isGeneratorExpression(value: unknown): value is string {
	return typeof value === 'string' && /^\$[A-Za-z]\w*\(/u.test(value.trim());
}

/** Parses a `$name(...)` expression without evaluating it. */
export function parseExpression(value: string): ParsedExpression {
	const trimmed = value.trim();
	const match = /^\$([A-Za-z]\w*)\((.*)\)$/su.exec(trimmed);

	if (!match) {
		throw new Error(`Invalid generator expression "${value}".`);
	}

	return {
		name: match[1],
		args: parseArgs(match[2].trim()),
	};
}

function parseArgs(input: string): unknown[] {
	if (!input) {
		return [];
	}

	return splitTopLevel(input).map(parseArg);
}

function splitTopLevel(input: string): string[] {
	const parts: string[] = [];
	let start = 0;
	let depth = 0;
	let quote: string | undefined;

	for (let index = 0; index < input.length; index += 1) {
		const char = input[index];

		if (quote) {
			if (char === quote && input[index - 1] !== '\\') {
				quote = undefined;
			}
			continue;
		}

		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}

		if (char === '(') {
			depth += 1;
		}
		if (char === ')') {
			depth -= 1;
		}
		if (char === ',' && depth === 0) {
			parts.push(input.slice(start, index).trim());
			start = index + 1;
		}
	}

	parts.push(input.slice(start).trim());
	return parts;
}

function parseArg(input: string): unknown {
	if (isGeneratorExpression(input)) {
		return parseExpression(input);
	}

	if (/^["'].*["']$/su.test(input)) {
		return String(input).slice(1, -1);
	}

	if (/^-?\d+(\.\d+)?$/u.test(input)) {
		return Number(input);
	}

	if (input === 'true') {
		return true;
	}

	if (input === 'false') {
		return false;
	}

	return input;
}
