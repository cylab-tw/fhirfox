import { useCallback, useEffect, useRef, useState } from 'react';

import type { JsonViewerFieldDoc, JsonViewerTooltipState } from '../types.js';
import type { MouseEvent } from 'react';

/** Tooltip behavior for key hover docs. */
export function useJsonViewerTooltip(enabled: boolean) {
	const [tooltip, setTooltip] = useState<JsonViewerTooltipState | null>(null);
	const timerRef = useRef<number | null>(null);

	const clearTimer = useCallback(() => {
		if (timerRef.current !== null) {
			window.clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const hideTooltip = useCallback(() => {
		clearTimer();
		setTooltip(null);
	}, [clearTimer]);

	const showTooltip = useCallback(
		(event: MouseEvent<HTMLElement>, doc: JsonViewerFieldDoc) => {
			if (!enabled) return;
			const rect = event.currentTarget.getBoundingClientRect();
			clearTimer();
			setTooltip(null);

			timerRef.current = window.setTimeout(() => {
				setTooltip({ x: rect.left, y: rect.bottom + 8, doc });
				timerRef.current = null;
			}, 100);
		},
		[enabled, clearTimer],
	);

	useEffect(() => {
		if (!enabled) hideTooltip();
	}, [enabled, hideTooltip]);

	// cleanup on unmount
	useEffect(() => () => clearTimer(), [clearTimer]);

	return { tooltip, hideTooltip, showTooltip };
}
