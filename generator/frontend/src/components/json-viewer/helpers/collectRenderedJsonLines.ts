import type { RenderedJsonLine } from '../types.ts';

function readLineText(element: Element): string | null {
	const clone = element.cloneNode(true);

	if (!(clone instanceof Element)) {
		return element.textContent?.trim() ?? null;
	}

	for (const annotation of clone.querySelectorAll('[data-json-annotation="true"]')) {
		annotation.remove();
	}

	return clone.textContent?.trim() ?? null;
}

/** Collect rendered JSON lines with visual indentation preserved. */
export function collectRenderedJsonLines(root: Element): RenderedJsonLine[] {
	const lines: RenderedJsonLine[] = [];

	function visit(element: Element, depth: number) {
		if (element.classList.contains('w-rjv-line')) {
			const text = readLineText(element);
			if (text && element instanceof HTMLElement) {
				lines.push({ element, text: `${'  '.repeat(depth)}${text}` });
			}
			return;
		}

		if (element.classList.contains('w-rjv-inner')) {
			const children = Array.from(element.children);
			const [openElement, wrapElement, closeElement] = children;

			if (openElement instanceof HTMLElement) {
				const text = readLineText(openElement);
				if (text) {
					lines.push({ element: openElement, text: `${'  '.repeat(depth)}${text}` });
				}
			}

			if (wrapElement?.classList.contains('w-rjv-wrap')) {
				for (const child of Array.from(wrapElement.children)) {
					visit(child, depth + 1);
				}
			}

			if (closeElement instanceof HTMLElement) {
				const text = readLineText(closeElement);
				if (text) {
					lines.push({ element: closeElement, text: `${'  '.repeat(depth)}${text}` });
				}
			}

			return;
		}

		for (const child of Array.from(element.children)) {
			visit(child, depth);
		}
	}

	visit(root, 0);
	return lines;
}

/** Find nearest rendered line container for a selection endpoint node. */
export function findClosestLineElement(node: Node | null, lines: RenderedJsonLine[]): HTMLElement | null {
	let current: Node | null = node;

	while (current) {
		if (current instanceof HTMLElement && lines.some((line) => line.element === current)) {
			return current;
		}
		current = current.parentNode;
	}

	return null;
}
