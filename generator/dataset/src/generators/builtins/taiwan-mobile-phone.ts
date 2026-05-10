import { randomFor } from '#/generators/random.js';

import type { GeneratorFunction } from '#/generators/types.js';

const prefixes = ['090', '091', '092', '093', '095', '096', '097', '098'];

/** Generates a deterministic Taiwan mobile phone number. */
export const taiwanMobilePhoneGenerator: GeneratorFunction = (_args, context) => {
	const prefix =
		prefixes[
			Math.min(Math.floor(randomFor(context, 'taiwanMobilePhone:prefix') * prefixes.length), prefixes.length - 1)
		] ?? '09';
	const suffix = Math.floor(randomFor(context, 'taiwanMobilePhone:suffix') * 10_000_000)
		.toString()
		.padStart(7, '0');

	return `${prefix}${suffix}`;
};
