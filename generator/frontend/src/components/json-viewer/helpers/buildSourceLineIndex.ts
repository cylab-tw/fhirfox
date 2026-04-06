import { SourceLineIndex } from '../types.ts';

/** Build line index from formatted JSON source. */
export function buildSourceLineIndex(content: string): SourceLineIndex {
	const lines = content.split('\n');
	const lineCount = lines.length;
	const matchingCloseLine = new Array<number>(lineCount).fill(-1);
	const stack: number[] = [];
	let inString = false;

	for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
		const line = lines[lineIndex]!;

		for (let charIndex = 0; charIndex < line.length; charIndex++) {
			const ch = line[charIndex];

			if (inString) {
				if (ch === '"') {
					let backslashCount = 0;
					let scanIndex = charIndex - 1;
					while (scanIndex >= 0 && line[scanIndex] === '\\') {
						backslashCount++;
						scanIndex--;
					}
					if (backslashCount % 2 === 0) inString = false;
				}
				continue;
			}

			if (ch === '"') {
				inString = true;
			} else if (ch === '{' || ch === '[') {
				stack.push(lineIndex);
			} else if (ch === '}' || ch === ']') {
				const openLine = stack.pop();
				if (openLine !== undefined) matchingCloseLine[openLine] = lineIndex;
			}
		}
	}

	return { lineCount, matchingCloseLine };
}
