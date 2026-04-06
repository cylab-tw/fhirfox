import { useEffect, useMemo, useState } from 'react';

/** Core viewer content & copy state derived from input value. */
export function useJsonViewerContentState(value: unknown, space = 2) {
	const [copied, setCopied] = useState(false);
	const [viewerSeed, setViewerSeed] = useState(0);
	const [lineNumbers, setLineNumbers] = useState<number[]>([1]);

	/** Stable JSON source string for copy and line indexing. */
	const content = useMemo(() => JSON.stringify(value, null, space), [value]);

	/** Copy full JSON source to clipboard. */
	async function copyContent() {
		await navigator.clipboard.writeText(content);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1500);
	}

	useEffect(() => {
		setViewerSeed((prev) => prev + 1);
	}, [content]);

	return { copied, viewerSeed, lineNumbers, setLineNumbers, content, copyContent };
}
