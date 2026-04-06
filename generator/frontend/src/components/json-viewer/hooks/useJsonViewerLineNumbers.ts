import { useCallback, useEffect, useMemo, useState } from 'react';

import { buildSourceLineIndex } from '../helpers/buildSourceLineIndex.ts';
import { collectSourceLineNumbers } from '../helpers/collectSourceLineNumbers.ts';
import { syncRenderedJsonCommas } from '../helpers/syncRenderedJsonCommas.ts';

import type { RefObject } from 'react';

/** Line numbers mapped to rendered (including collapsed) JSON tree. */
export function useJsonViewerLineNumbers(content: string, jsonViewRef: RefObject<HTMLDivElement | null>) {
	const [lineNumbers, setLineNumbers] = useState<number[]>([1]);
	// Pre-compute source bracket matching once per content update.
	const sourceLineIndex = useMemo(() => buildSourceLineIndex(content), [content]);

	// Fallback: show full source line range when JsonView DOM is not ready yet.
	const fallbackSourceLineNumbers = useMemo(
		() => Array.from({ length: sourceLineIndex.lineCount }, (_, i) => i + 1),
		[sourceLineIndex.lineCount],
	);

	const resolveJsonRoot = useCallback((): Element | null => {
		const current = jsonViewRef.current;
		if (!current) {
			return null;
		}
		// Ref can point to the root itself or a wrapper containing it.
		if (current.classList.contains('w-rjv')) {
			return current;
		}
		return current.querySelector('.w-rjv');
	}, [jsonViewRef]);

	const updateLineNumbers = useCallback((next: number[]) => {
		setLineNumbers((prev) => (arraysEqual(prev, next) ? prev : next));
	}, []);

	const recompute = useCallback(() => {
		const root = resolveJsonRoot();
		if (!root) {
			updateLineNumbers(fallbackSourceLineNumbers);
			return;
		}
		// Map visible rendered rows (expanded/collapsed) back to source line numbers.
		updateLineNumbers(collectSourceLineNumbers(root, sourceLineIndex));
	}, [fallbackSourceLineNumbers, resolveJsonRoot, sourceLineIndex, updateLineNumbers]);

	// Initial + value/content change
	useEffect(() => {
		recompute();
	}, [recompute]);

	// Keep line numbers in sync with JSON tree DOM updates (expand/collapse/render changes).
	useEffect(() => {
		const root = resolveJsonRoot();

		if (!root) {
			return;
		}

		let mounted = true;
		let pendingMicrotask = false;
		let pendingCommaRaf: number | null = null;

		const scheduleLineNumbers = () => {
			if (pendingMicrotask) {
				return;
			}

			pendingMicrotask = true;
			queueMicrotask(() => {
				pendingMicrotask = false;
				if (!mounted) {
					return;
				}
				recompute();
			});
		};

		const scheduleCommaSync = () => {
			if (pendingCommaRaf !== null) {
				return;
			}

			pendingCommaRaf = window.requestAnimationFrame(() => {
				pendingCommaRaf = null;
				if (!mounted) {
					return;
				}
				const latestRoot = resolveJsonRoot();
				if (!latestRoot) {
					return;
				}

				mutationObserver.disconnect();
				syncRenderedJsonCommas(latestRoot);
				mutationObserver.observe(latestRoot, {
					attributes: true,
					childList: true,
					subtree: true,
				});
			});
		};

		const handleMutation = () => {
			scheduleLineNumbers();
			scheduleCommaSync();
		};

		const handleResize = () => {
			scheduleLineNumbers();
		};

		const mutationObserver = new MutationObserver(handleMutation);
		mutationObserver.observe(root, {
			attributes: true,
			childList: true,
			subtree: true,
		});

		const resizeObserver = new ResizeObserver(handleResize);
		resizeObserver.observe(root);

		scheduleLineNumbers();
		scheduleCommaSync();

		return () => {
			mounted = false;
			mutationObserver.disconnect();
			resizeObserver.disconnect();
			if (pendingCommaRaf !== null) {
				window.cancelAnimationFrame(pendingCommaRaf);
			}
		};
	}, [recompute, resolveJsonRoot]);

	return { lineNumbers };
}

function arraysEqual(a: number[], b: number[]): boolean {
	if (a.length !== b.length) {
		return false;
	}
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return false;
		}
	}
	return true;
}
