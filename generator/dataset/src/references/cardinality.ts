import type { Cardinality } from './types.js';

/** Parses author-facing cardinality such as `1`, `0..1`, or `1..*`. */
export function parseCardinality(input = '1..1'): Cardinality {
	if (/^\d+$/u.test(input)) {
		const exact = Number(input);
		return { min: exact, max: exact };
	}

	const match = /^(\d+)\.\.(\d+|\*)$/u.exec(input);
	if (!match) {
		throw new Error(`Invalid cardinality "${input}".`);
	}

	return {
		min: Number(match[1]),
		max: match[2] === '*' ? 'many' : Number(match[2]),
	};
}

/** Throws when the number of selected references violates the expected range. */
export function assertCardinality(count: number, input = '1..1'): void {
	const cardinality = parseCardinality(input);
	const max = cardinality.max === 'many' ? Number.POSITIVE_INFINITY : cardinality.max;

	if (count < cardinality.min || count > max) {
		throw new Error(`Expected ${input} references, got ${count}.`);
	}
}

/** Returns whether a cardinality can emit more than one target id. */
export function isMany(input = '1..1'): boolean {
	const cardinality = parseCardinality(input);
	return cardinality.max === 'many' || cardinality.max > 1;
}
