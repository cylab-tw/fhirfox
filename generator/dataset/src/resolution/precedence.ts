import type { FieldDefaultValue, FieldDefinition } from '#/model/index.js';
import type { PresetFieldValue } from '#/preset/index.js';

/** Mutable field state before a source record is emitted. */
export interface FieldPlan {
	definition: FieldDefinition;
	value?: unknown;
	default?: FieldDefaultValue | string;
	input?: Record<string, unknown>;
	from?: string;
}

/** Creates field plans seeded with field defaults from a resource type definition. */
export function createFieldPlans(definitions: FieldDefinition[]): Map<string, FieldPlan> {
	return new Map(
		definitions.map((definition) => [
			definition.id,
			{
				definition,
				default: definition.default,
				input: definition.input,
			},
		]),
	);
}

/** Applies a preset field value before scenario fields are considered. */
export function applyPresetField(plan: FieldPlan, value: PresetFieldValue, from: string): FieldPlan {
	const patch = toPatch(value);
	return {
		...plan,
		...patch,
		from,
	};
}

/** Merges scenario input into the field plan used by a default expression. */
export function applyInput(plan: FieldPlan, input: unknown): FieldPlan {
	const patch = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : { value: input };
	return {
		...plan,
		input: {
			...(plan.input ?? {}),
			...patch,
		},
	};
}

function toPatch(value: PresetFieldValue): Partial<FieldPlan> {
	if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
		const record = value as Record<string, unknown>;
		if ('generator' in record || 'input' in record || 'value' in record) {
			return {
				value: record.value,
				default: typeof record.generator === 'string' ? record.generator : undefined,
				input:
					typeof record.input === 'object' && record.input !== null
						? (record.input as Record<string, unknown>)
						: undefined,
			};
		}
	}

	return {
		value,
		default: typeof value === 'string' && value.startsWith('$') ? value : undefined,
	};
}
