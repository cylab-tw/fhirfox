import { randomFor } from '#/generators/random.js';

import type { GeneratorFunction } from '#/generators/types.js';

const letterCodes: Record<string, number> = {
	A: 10,
	B: 11,
	C: 12,
	D: 13,
	E: 14,
	F: 15,
	G: 16,
	H: 17,
	I: 34,
	J: 18,
	K: 19,
	L: 20,
	M: 21,
	N: 22,
	O: 35,
	P: 23,
	Q: 24,
	R: 25,
	S: 26,
	T: 27,
	U: 28,
	V: 29,
	W: 32,
	X: 30,
	Y: 31,
	Z: 33,
};
const letters = Object.keys(letterCodes);

/** Generates a deterministic Taiwan national id with a valid checksum. */
export const taiwanNationalIdGenerator: GeneratorFunction = (_args, context) => {
	const letter =
		letters[Math.min(Math.floor(randomFor(context, 'taiwanNationalId:letter') * letters.length), letters.length - 1)] ??
		'A';
	const genderDigit = randomFor(context, 'taiwanNationalId:gender') < 0.5 ? 1 : 2;
	const serial = Math.floor(randomFor(context, 'taiwanNationalId:serial') * 10_000_000)
		.toString()
		.padStart(7, '0');
	const body = `${genderDigit}${serial}`;

	return `${letter}${body}${checksum(letter, body)}`;
};

function checksum(letter: string, body: string): number {
	const code = letterCodes[letter] ?? letterCodes.A;
	const digits = [Math.floor(code / 10), code % 10, ...body.split('').map(Number)];
	const weights = [1, 9, 8, 7, 6, 5, 4, 3, 2, 1];
	const sum = digits.reduce((total, digit, index) => total + digit * (weights[index] ?? 0), 0);
	return (10 - (sum % 10)) % 10;
}
