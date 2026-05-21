import { isGeneratorExpression, parseExpression } from './expression.js';

import type { GeneratorContext, GeneratorRegistry, ParsedExpression } from './types.js';

/** Evaluates a string expression and leaves literal values unchanged. */
export function evaluateValue(value: unknown, context: GeneratorContext, registry: GeneratorRegistry): unknown {
	if (typeof value === 'string' && isGeneratorExpression(value)) {
		return evaluateExpression(parseExpression(value), context, registry);
	}

	return value;
}

/** Evaluates a field default with resolver-provided input appended or merged. */
export function evaluateGenerator(
	generatorExpression: string,
	extraArgs: unknown[],
	context: GeneratorContext,
	registry: GeneratorRegistry,
): unknown {
	const expression = parseExpression(generatorExpression);
	return evaluateExpression(
		{
			...expression,
			args: mergeArgs(expression.args, extraArgs),
		},
		context,
		registry,
	);
}

function evaluateExpression(
	expression: ParsedExpression,
	context: GeneratorContext,
	registry: GeneratorRegistry,
): unknown {
	const generator = registry.get(expression.name);

	if (!generator) {
		throw new Error(`Unknown generator "${expression.name}".`);
	}

	const args = expression.args.map((arg) =>
		typeof arg === 'object' && arg !== null && 'name' in arg && 'args' in arg
			? evaluateExpression(arg as ParsedExpression, context, registry)
			: arg,
	);

	return generator(args, context);
}

function mergeArgs(args: unknown[], extraArgs: unknown[]): unknown[] {
	if (extraArgs.length === 0) {
		return args;
	}

	if (args.length === 0) {
		return extraArgs;
	}

	const [last] = args.slice(-1);
	const [extra] = extraArgs;
	if (isRecord(last) && isRecord(extra)) {
		return [...args.slice(0, -1), { ...last, ...extra }];
	}

	return [...args, ...extraArgs];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
