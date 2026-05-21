import type { GeneratorContext, GeneratorFunction } from '#/generators/types.js';

/** Maps a scenario input or generated value to a field value through a case table. */
export const caseGenerator: GeneratorFunction = (args, context) => {
	const options = readOptions(args);
	return readCaseValue(options, context) ?? options.default;
};

export function readCaseValue(options: Record<string, unknown>, context: GeneratorContext): unknown {
	const selector = readSelector(options, context);
	const cases = isRecord(options.cases) ? options.cases : {};
	const entry = selector === undefined ? undefined : cases[String(selector)];
	const field = typeof options.field === 'string' ? options.field : context.field;

	if (isRecord(entry) && field) {
		return entry[field];
	}

	return entry;
}

function readSelector(options: Record<string, unknown>, context: GeneratorContext): unknown {
	if ('value' in options) {
		return options.value;
	}

	const source = typeof options.source === 'string' ? options.source : context.field;
	if (!source) {
		return undefined;
	}

	return context.inputs[source] ?? context.values[source];
}

function readOptions(args: unknown[]): Record<string, unknown> {
	return args.reduce<Record<string, unknown>>((options, arg) => (isRecord(arg) ? { ...options, ...arg } : options), {});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
