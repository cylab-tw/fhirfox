import { randomFor } from '#/generators/random.js';

import type { GeneratorFunction } from '#/generators/types.js';

const familyNames = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭', '謝', '郭', '洪', '曾'];
const compoundFamilyNames = ['歐陽', '司徒', '上官', '諸葛'];
const givenNameFirst = ['怡', '家', '子', '承', '雅', '柏', '冠', '欣', '宇', '思', '宥', '品', '佳', '俊', '庭'];
const givenNameSecond = ['君', '豪', '晴', '瑜', '翔', '婷', '安', '萱', '穎', '瑋', '涵', '辰', '妤', '軒', '霖'];

/** Generates a deterministic Traditional Chinese human name. */
export const humanNameGenerator: GeneratorFunction = (_args, context) => {
	const familyName =
		randomFor(context, 'humanName:compoundFamilyName') < 0.03
			? pick(compoundFamilyNames, randomFor(context, 'humanName:compoundFamilyName:value'))
			: pick(familyNames, randomFor(context, 'humanName:familyName'));
	const givenName =
		randomFor(context, 'humanName:singleGivenName') < 0.12
			? pick(givenNameSecond, randomFor(context, 'humanName:givenName:single'))
			: `${pick(givenNameFirst, randomFor(context, 'humanName:givenName:first'))}${pick(
					givenNameSecond,
					randomFor(context, 'humanName:givenName:second'),
				)}`;

	return `${familyName}${givenName}`;
};

function pick(values: string[], random: number): string {
	return values[Math.min(Math.floor(random * values.length), values.length - 1)] ?? values[0] ?? '';
}
