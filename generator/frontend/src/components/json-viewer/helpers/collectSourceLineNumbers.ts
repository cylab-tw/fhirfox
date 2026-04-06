import { SourceLineIndex } from '../types.ts';

/** Collect gutter numbers to match current rendered (expanded/collapsed) tree. */
export function collectSourceLineNumbers(root: Element, index: SourceLineIndex): number[] {
	const result: number[] = [];
	let cursor = 0;

	function visit(element: Element) {
		if (element.classList.contains('w-rjv-line')) {
			result.push(cursor + 1);
			cursor++;
			return;
		}

		if (element.classList.contains('w-rjv-inner')) {
			const children = Array.from(element.children);
			const [openElement, wrapElement, closeElement] = children;

			const isCollapsedOrEmpty =
				!wrapElement || !wrapElement.classList.contains('w-rjv-wrap') || wrapElement.children.length === 0;

			if (isCollapsedOrEmpty) {
				result.push(cursor + 1);
				const closeLine = index.matchingCloseLine[cursor];
				cursor = closeLine !== undefined && closeLine >= 0 ? closeLine + 1 : cursor + 1;
			} else {
				if (openElement) {
					result.push(cursor + 1);
					cursor++;
				}

				if (wrapElement?.classList.contains('w-rjv-wrap')) {
					for (const child of Array.from(wrapElement.children)) {
						visit(child);
					}
				}

				if (closeElement) {
					result.push(cursor + 1);
					cursor++;
				}
			}

			return;
		}

		for (const child of Array.from(element.children)) {
			visit(child);
		}
	}

	visit(root);
	return result.length > 0 ? result : [1];
}
