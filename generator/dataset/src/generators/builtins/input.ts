import type { GeneratorFunction } from '#/generators/types.js';

/** Reads a scenario input by name, defaulting to the field currently being filled. */
export const inputGenerator: GeneratorFunction = (args, context) => {
	const options = readOptions(args);
	const name = readName(args) ?? context.field;

	if ('value' in options) {
		return options.value;
	}

	if (name && name in context.inputs) {
		return context.inputs[name];
	}

	return options.default;
};

function readName(args: unknown[]): string | undefined {
	const [first] = args;
	if (typeof first === 'string') {
		return first;
	}

	if (isRecord(first) && typeof first.name === 'string') {
		return first.name;
	}

	return undefined;
}

function readOptions(args: unknown[]): Record<string, unknown> {
	return args.reduce<Record<string, unknown>>((options, arg) => (isRecord(arg) ? { ...options, ...arg } : options), {});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
