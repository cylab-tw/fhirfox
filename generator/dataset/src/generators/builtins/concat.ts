import type { GeneratorFunction } from '#/generators/types.js';

/** Concatenates generator arguments into one string. */
export const concatGenerator: GeneratorFunction = (args) => args.map(stringify).join('');

function stringify(value: unknown): string {
	if (value === undefined || value === null) {
		return '';
	}

	if (Array.isArray(value)) {
		return value.map(stringify).join('');
	}

	return String(value);
}
