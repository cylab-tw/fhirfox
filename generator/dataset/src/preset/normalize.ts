import type { Preset } from './types.js';

/** Fills omitted optional arrays and maps on a preset. */
export function normalizePreset(preset: Preset): Preset {
	return {
		...preset,
		overrides: preset.overrides ?? [],
		fields: preset.fields ?? {},
		requires: preset.requires ?? [],
	};
}

/** Builds a preset lookup table keyed by preset id. */
export function indexPresets(presets: Preset[]): Map<string, Preset> {
	return new Map(presets.map((preset) => [preset.id, normalizePreset(preset)]));
}
