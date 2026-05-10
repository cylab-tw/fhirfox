import type { Preset, PresetFieldValue } from './types.js';

/** Field values contributed by presets after they are merged. */
export type FieldPatch = Record<string, PresetFieldValue>;

/** Merges presets in application order; later presets replace earlier fields. */
export function mergePresetFields(presets: Preset[]): FieldPatch {
	const fields: FieldPatch = {};

	for (const preset of presets) {
		Object.assign(fields, preset.fields ?? {});
	}

	return fields;
}
