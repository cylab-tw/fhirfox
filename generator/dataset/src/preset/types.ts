import type { GeneratorInput } from '#/model/index.js';
import type { ReferenceSelection } from '#/references/index.js';

/** Value a preset can apply to one field. */
export type PresetFieldValue =
	| string
	| number
	| boolean
	| null
	| {
			generator?: string;
			input?: GeneratorInput;
			value?: unknown;
	  };

interface PresetRequirementBase {
	/** Presets to apply if this supporting record must be generated. */
	with?: string[];
	/** Expected number of selected records when `select` is used. */
	cardinality?: string;
	/** Provider query used to select existing records. */
	select?: Record<string, unknown>;
	/** Selection strategy used when provider records match. */
	strategy?: ReferenceSelection['strategy'];
	/** Keep provider selection order instead of sorting deterministically. */
	preserveSelectionOrder?: boolean;
}

/** Supporting record that a preset needs before its fields can be resolved. */
export type PresetRequirement =
	| (PresetRequirementBase & {
			/** Existing alias to use, or alias to create when no scenario record exists. */
			alias: string;
			/** Resource type to generate or select for this alias. */
			resourceType: string;
	  })
	| (PresetRequirementBase & {
			/** Relationship slot whose resource type comes from the resource definition. */
			binding: string;
	  });

/** Reusable field patch for one resource type. */
export interface Preset {
	/** Stable preset id used in `with` lists. */
	id: string;
	/** Resource type this preset can be applied to. */
	resourceType: string;
	summary?: string;
	/** Fields this preset is expected to replace from earlier presets. */
	overrides?: string[];
	/** Field values contributed by this preset. */
	fields?: Record<string, PresetFieldValue>;
	/** Supporting records this preset needs. */
	requires?: PresetRequirement[];
}
