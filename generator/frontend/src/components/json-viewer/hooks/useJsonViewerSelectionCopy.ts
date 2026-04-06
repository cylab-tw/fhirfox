import { useCallback } from 'react';

import { collectRenderedJsonLines, findClosestLineElement } from '../helpers/collectRenderedJsonLines.ts';

import type { ClipboardEvent, RefObject } from 'react';

function resolveJsonRoot(rootRef: RefObject<HTMLDivElement | null>): Element | null {
	const current = rootRef.current;
	if (!current) {
		return null;
	}

	if (current.classList.contains('w-rjv')) {
		return current;
	}

	return current.querySelector('.w-rjv');
}

/** Copy selected rendered JSON lines while preserving indentation. */
export function useJsonViewerSelectionCopy(jsonViewRef: RefObject<HTMLDivElement | null>) {
	const onCopyCapture = useCallback(
		(event: ClipboardEvent<HTMLDivElement>) => {
			const selection = window.getSelection();
			if (!selection || selection.isCollapsed || !selection.toString().includes('\n')) {
				return;
			}

			const jsonRoot = resolveJsonRoot(jsonViewRef);
			if (!jsonRoot) {
				return;
			}

			const lineEntries = collectRenderedJsonLines(jsonRoot);
			if (lineEntries.length === 0) {
				return;
			}

			const anchorLineElement = findClosestLineElement(selection.anchorNode, lineEntries);
			const focusLineElement = findClosestLineElement(selection.focusNode, lineEntries);
			if (!anchorLineElement || !focusLineElement) {
				return;
			}

			const startIndex = lineEntries.findIndex((entry) => entry.element === anchorLineElement);
			const endIndex = lineEntries.findIndex((entry) => entry.element === focusLineElement);
			if (startIndex === -1 || endIndex === -1 || startIndex === endIndex) {
				return;
			}

			const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
			const copied = lineEntries
				.slice(from, to + 1)
				.map((entry) => entry.text)
				.join('\n');

			event.preventDefault();
			event.clipboardData.setData('text/plain', copied);
		},
		[jsonViewRef],
	);

	return { onCopyCapture };
}
