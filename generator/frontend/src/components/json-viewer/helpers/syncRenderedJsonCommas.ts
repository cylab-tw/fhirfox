function hasTrailingRenderedSibling(element: HTMLElement): boolean {
	const wrap = element.parentElement;

	if (!wrap?.classList.contains('w-rjv-wrap')) {
		return false;
	}

	const renderedSiblings = Array.from(wrap.children).filter(
		(child) => child.classList.contains('w-rjv-line') || child.classList.contains('w-rjv-inner'),
	);

	return renderedSiblings[renderedSiblings.length - 1] !== element;
}

function findTrailingCommaTarget(element: HTMLElement): HTMLElement | null {
	const children = Array.from(element.children);
	const openElement = children[0];
	const closeElement = children[2];

	if (closeElement instanceof HTMLElement) {
		return closeElement;
	}

	return openElement instanceof HTMLElement ? openElement : null;
}

/** Sync trailing commas for nested JSON blocks rendered by JsonView internals. */
export function syncRenderedJsonCommas(root: Element) {
	for (const comma of root.querySelectorAll('[data-json-generated-comma="true"]')) {
		comma.remove();
	}

	for (const element of root.querySelectorAll('.w-rjv-inner')) {
		if (!(element instanceof HTMLElement) || !hasTrailingRenderedSibling(element)) {
			continue;
		}

		const commaTarget = findTrailingCommaTarget(element);
		if (!commaTarget) {
			continue;
		}

		const comma = document.createElement('span');
		comma.dataset.jsonGeneratedComma = 'true';
		comma.className = 'text-slate-400';
		comma.textContent = ',';
		commaTarget.appendChild(comma);
	}
}
