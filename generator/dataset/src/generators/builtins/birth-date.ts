import { randomFor } from '#/generators/random.js';

import type { GeneratorFunction } from '#/generators/types.js';

type AgeBounds = {
	gt?: number;
	gte?: number;
	lt?: number;
	lte?: number;
	min?: number;
	max?: number;
	minAge?: number;
	maxAge?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function collectBounds(input: unknown): AgeBounds {
	if (!isRecord(input)) {
		return {};
	}

	const age = input.age;
	if (typeof age === 'number') {
		return { gte: age, lte: age };
	}
	if (isRecord(age)) {
		return { ...input, ...age } as AgeBounds;
	}

	return input as AgeBounds;
}

function resolveAgeRange(input: unknown): { min: number; max: number } {
	if (typeof input === 'number' && Number.isFinite(input)) {
		return { min: input, max: input };
	}

	const bounds = collectBounds(input);
	const gt = numberValue(bounds.gt);
	const lt = numberValue(bounds.lt);
	const minCandidates = [
		numberValue(bounds.min),
		numberValue(bounds.minAge),
		numberValue(bounds.gte),
		gt === undefined ? undefined : gt + 1,
	].filter((value): value is number => value !== undefined);
	const maxCandidates = [
		numberValue(bounds.max),
		numberValue(bounds.maxAge),
		numberValue(bounds.lte),
		lt === undefined ? undefined : lt - 1,
	].filter((value): value is number => value !== undefined);

	const min = Math.ceil(Math.max(0, ...minCandidates));
	const max = Math.floor(Math.min(120, ...maxCandidates));

	if (max < min) {
		throw new Error(`Invalid birthDate age range: min ${min} is greater than max ${max}.`);
	}

	return { min, max };
}

/** Generates a birth date that makes the person the requested age on `context.now`. */
export const birthDateGenerator: GeneratorFunction = (args, context) => {
	const input = normalizeArgs(args);
	const { min, max } = resolveAgeRange(input);
	const ageRandom = randomFor(context, `birthDate:age:${min}:${max}`);
	const age = min + Math.floor((max - min + 1) * ageRandom);
	const start = Date.UTC(
		context.now.getUTCFullYear() - age - 1,
		context.now.getUTCMonth(),
		context.now.getUTCDate() + 1,
	);
	const end = Date.UTC(context.now.getUTCFullYear() - age, context.now.getUTCMonth(), context.now.getUTCDate() + 1);
	const random = randomFor(context, `birthDate:${age}`);

	return new Date(start + Math.floor((end - start) * random)).toISOString().slice(0, 10);
};

function normalizeArgs(args: unknown[]): unknown {
	const [first, second, third] = args;

	if (typeof first === 'number' && typeof second === 'number') {
		const range = { min: first, max: second };
		return isRecord(third) ? { ...range, ...third } : range;
	}

	return first;
}
