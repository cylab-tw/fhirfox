import { createStableRandom } from '#/generators/index.js';

import type { ReferenceSelection } from './types.js';
import type { SourceResource } from '#/model/index.js';

/** Selects provider records deterministically from query matches. */
export function selectReferences(
	matches: SourceResource[],
	selection: ReferenceSelection,
	seed: string,
): SourceResource[] {
	const sorted = [...matches].sort((left, right) => left.id.localeCompare(right.id));
	const strategy = selection.strategy ?? 'first';

	if (strategy === 'one') {
		if (sorted.length !== 1) {
			throw new Error(`Expected exactly one ${selection.resourceType} match, got ${sorted.length}.`);
		}
		return sorted;
	}

	if (strategy === 'sample') {
		const random = createStableRandom(`${seed}:${selection.resourceType}:${JSON.stringify(selection.select ?? {})}`);
		const shuffled = [...sorted].sort(() => random() - 0.5);
		return selection.preserveSelectionOrder
			? shuffled
			: shuffled.sort((left, right) => left.id.localeCompare(right.id));
	}

	return sorted;
}
