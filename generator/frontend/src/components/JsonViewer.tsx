import { useEffect, useMemo, useRef, useState } from 'react';
import JsonView from '@uiw/react-json-view';

import { getFieldPath, getSourceFieldDoc, getSourceFieldPathPrefix } from '../lib/source-json-docs.js';
import { formatSourceResourceType } from '../lib/source-resource-display.js';

import type { CSSProperties, ClipboardEvent, HTMLAttributes, MouseEvent } from 'react';
import type { SourceCodeDisplayMap, SourceFieldDocRecord } from '../types.js';

const JSON_FONT_SIZE_PX = 13.5;
const JSON_LINE_HEIGHT = 1.75;
const JSON_LINE_HEIGHT_PX = JSON_FONT_SIZE_PX * JSON_LINE_HEIGHT;
const JSON_GUTTER_WIDTH_REM = 3.25;

const sourceViewerTheme: CSSProperties = {
	'--w-rjv-background-color': 'transparent',
	'--w-rjv-font-family':
		'ui-monospace, SFMono-Regular, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace',
	'--w-rjv-color': '#334155',
	'--w-rjv-line-color': 'rgba(148, 163, 184, 0.22)',
	'--w-rjv-arrow-color': '#94a3b8',
	'--w-rjv-info-color': '#94a3b8',
	'--w-rjv-curlybraces-color': '#64748b',
	'--w-rjv-brackets-color': '#64748b',
	'--w-rjv-colon-color': '#94a3b8',
	'--w-rjv-key-string': '#475569',
	'--w-rjv-key-number': '#475569',
	'--w-rjv-type-string-color': '#0f766e',
	'--w-rjv-type-int-color': '#7c3aed',
	'--w-rjv-type-float-color': '#7c3aed',
	'--w-rjv-type-boolean-color': '#1d4ed8',
	'--w-rjv-type-null-color': '#64748b',
	'--w-rjv-quotes-string-color': '#0f766e',
	fontSize: `${JSON_FONT_SIZE_PX}px`,
	lineHeight: `${JSON_LINE_HEIGHT_PX}px`,
	whiteSpace: 'nowrap',
} as CSSProperties;

export function JsonViewer({
	value,
	sourceFieldDocs,
	sourceCodeDisplayMap,
	docsEnabled,
	showCodeDisplayValues = false,
	onSourceResourceSelect,
	className,
}: {
	value: unknown;
	sourceFieldDocs: Record<string, SourceFieldDocRecord>;
	sourceCodeDisplayMap: SourceCodeDisplayMap;
	docsEnabled: boolean;
	showCodeDisplayValues?: boolean;
	onSourceResourceSelect?: (sourceKey: string) => void;
	className?: string;
}) {
	const [copied, setCopied] = useState(false);
	const [viewerSeed, setViewerSeed] = useState(0);
	const [tooltip, setTooltip] = useState<TooltipState | null>(null);
	const [lineNumbers, setLineNumbers] = useState([1]);
	const tooltipTimerRef = useRef<number | null>(null);
	const scrollContainerRef = useRef<HTMLDivElement | null>(null);
	const renderedContentRef = useRef<HTMLDivElement | null>(null);
	const renderedValueRef = useRef<HTMLDivElement | null>(null);
	const content = useMemo(() => JSON.stringify(value, null, 2), [value]);
	const sourceFieldPathPrefix = useMemo(
		() => (docsEnabled ? getSourceFieldPathPrefix(value) : undefined),
		[docsEnabled, value],
	);

	async function handleCopy() {
		await navigator.clipboard.writeText(content);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1500);
	}

	function clearTooltipTimer() {
		if (tooltipTimerRef.current !== null) {
			window.clearTimeout(tooltipTimerRef.current);
			tooltipTimerRef.current = null;
		}
	}

	function hideTooltip() {
		clearTooltipTimer();
		setTooltip(null);
	}

	function showTooltip(event: MouseEvent<HTMLSpanElement>, doc: SourceFieldDocRecord) {
		if (!docsEnabled) {
			return;
		}

		const targetRect = event.currentTarget.getBoundingClientRect();
		clearTooltipTimer();
		setTooltip(null);
		tooltipTimerRef.current = window.setTimeout(() => {
			setTooltip({
				doc,
				x: targetRect.left,
				y: targetRect.bottom + 8,
			});
			tooltipTimerRef.current = null;
		}, 100);
	}

	function handleSelectionCopy(event: ClipboardEvent<HTMLDivElement>) {
		const selection = window.getSelection();
		const contentRoot = renderedValueRef.current;
		if (!selection || selection.isCollapsed || !contentRoot || !selection.toString().includes('\n')) {
			return;
		}

		const jsonRoot = contentRoot.querySelector('.w-rjv');
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
		event.preventDefault();
		event.clipboardData.setData(
			'text/plain',
			lineEntries
				.slice(from, to + 1)
				.map((entry) => entry.text)
				.join('\n'),
		);
	}

	useEffect(() => () => clearTooltipTimer(), []);
	useEffect(() => {
		if (!docsEnabled) {
			hideTooltip();
		}
	}, [docsEnabled]);
	useEffect(() => {
		setViewerSeed((value) => value + 1);
		scrollContainerRef.current?.scrollTo({ top: 0 });
	}, [content, docsEnabled]);

	useEffect(() => {
		const wrapper = renderedContentRef.current;
		const contentRoot = renderedValueRef.current;
		if (!wrapper || !contentRoot) {
			return;
		}

		const updateLineNumbers = () => {
			const jsonRoot = contentRoot.querySelector('.w-rjv');
			if (jsonRoot) {
				syncInteractiveCursors(jsonRoot);
				syncRenderedJsonCommas(jsonRoot);
			}
			const totalLines = jsonRoot
				? Math.max(1, collectRenderedJsonLines(jsonRoot).length)
				: Math.max(1, content.split('\n').length);
			setLineNumbers((current) =>
				current.length === totalLines ? current : Array.from({ length: totalLines }, (_, index) => index + 1),
			);
		};

		updateLineNumbers();

		const resizeObserver = new ResizeObserver(() => {
			updateLineNumbers();
		});
		resizeObserver.observe(wrapper);
		resizeObserver.observe(contentRoot);

		const mutationObserver = new MutationObserver(() => {
			window.requestAnimationFrame(updateLineNumbers);
		});
		mutationObserver.observe(contentRoot, {
			attributes: true,
			childList: true,
			subtree: true,
		});

		return () => {
			resizeObserver.disconnect();
			mutationObserver.disconnect();
		};
	}, [content, docsEnabled, viewerSeed]);

	return (
		<div
			className={[
				'relative flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50 shadow-[0_16px_40px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.85)]',
				className ?? '',
			].join(' ')}
		>
			<div className="pointer-events-none absolute right-6 top-3 z-10">
				<JsonViewerToolbar copied={copied} onCopy={() => void handleCopy()} />
			</div>
			<div
				ref={scrollContainerRef}
				className="relative min-h-0 flex-1 overflow-auto bg-slate-50"
				data-json-scroll-root=""
				onScrollCapture={hideTooltip}
			>
				<div className="relative min-h-full bg-[linear-gradient(to_bottom,rgba(248,250,252,0.75),rgba(255,255,255,0))] pt-3 pr-[16rem]">
					<div
						aria-hidden="true"
						className="absolute inset-y-0 left-0 flex select-none flex-col border-r border-slate-200/70 bg-[linear-gradient(to_bottom,rgba(244,247,251,0.88),rgba(248,250,252,0.38))] px-2.5 text-right font-mono text-[12px] font-medium text-slate-400"
						style={{ lineHeight: `${JSON_LINE_HEIGHT_PX}px`, width: `${JSON_GUTTER_WIDTH_REM}rem` }}
					>
						<div className="pt-3">
							{lineNumbers.map((lineNumber) => (
								<div key={lineNumber}>{lineNumber}</div>
							))}
						</div>
						<div className="flex-1 bg-[linear-gradient(to_bottom,rgba(248,250,252,0),rgba(248,250,252,0.7))]" />
					</div>
					<div
						className="grid min-h-full"
						style={{ gridTemplateColumns: `${JSON_GUTTER_WIDTH_REM}rem minmax(0, 1fr)` }}
					>
						<div aria-hidden="true" className="min-h-full" />
						<div ref={renderedContentRef} className="min-w-max px-4 pb-5">
							<div ref={renderedValueRef} onCopyCapture={handleSelectionCopy}>
								{isJsonObject(value) ? (
									<JsonView
										key={viewerSeed}
										value={value}
										collapsed={false}
										displayDataTypes={false}
										displayObjectSize={false}
										enableClipboard={false}
										highlightUpdates={false}
										shortenTextAfterLength={0}
										style={sourceViewerTheme}
									>
										<JsonView.Colon
											render={(props, { parentValue, keyName }) => {
												if (Array.isArray(parentValue) && typeof keyName === 'number') {
													return <span style={{ display: 'none' }} />;
												}
												return <span {...props} />;
											}}
										/>
										<JsonView.KeyName
											render={({ ...props }, { keyName, keys, parentValue }) => {
												return (
													<DocumentedKeyName
														props={props}
														keyName={keyName}
														keys={keys}
														parentValue={parentValue}
														pathPrefix={sourceFieldPathPrefix}
														docsEnabled={docsEnabled}
														sourceFieldDocs={sourceFieldDocs}
														onShowTooltip={showTooltip}
														onHideTooltip={hideTooltip}
													/>
												);
											}}
										/>
										<JsonView.Row
											render={({ children, ...props }, { keyName, keys, parentValue, value: rowValue }) => {
												const displayValue = showCodeDisplayValues
													? getCodeDisplayValue(
															keyName,
															keys,
															rowValue,
															parentValue,
															sourceFieldPathPrefix,
															sourceCodeDisplayMap,
														)
													: undefined;
												const sourceResourceKey = getSourceResourceLinkTarget(
													keyName,
													keys,
													rowValue,
													parentValue,
													sourceFieldPathPrefix,
													sourceFieldDocs,
												);
												const shouldShowComma = hasTrailingComma(keyName, parentValue);

												return (
													<div {...props}>
														{children}
														{shouldShowComma ? <span className="text-slate-400">,</span> : null}
														{displayValue ? (
															<span
																data-json-annotation="true"
																className="ml-2 inline select-none text-[12px] italic font-normal leading-5 text-slate-500/90"
																title={displayValue}
															>
																{displayValue}
															</span>
														) : null}
														{onSourceResourceSelect && sourceResourceKey ? (
															<button
																type="button"
																onClick={(event) => {
																	event.stopPropagation();
																	onSourceResourceSelect(sourceResourceKey);
																}}
																data-json-annotation="true"
																className="ml-2 inline select-none italic cursor-pointer text-[12px] font-normal leading-5 text-slate-600/95 underline decoration-slate-500/35 underline-offset-2 transition hover:text-slate-800 hover:decoration-slate-700/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
																title={`查看 ${sourceResourceKey}`}
															>
																{formatSourceResourceKeyAnnotation(sourceResourceKey)}
															</button>
														) : sourceResourceKey ? (
															<span
																data-json-annotation="true"
																className="ml-2 inline select-none text-[12px] italic font-normal leading-5 text-slate-500/90"
																title={sourceResourceKey}
															>
																{formatSourceResourceKeyAnnotation(sourceResourceKey)}
															</span>
														) : null}
													</div>
												);
											}}
										/>
									</JsonView>
								) : (
									<pre
										className="whitespace-pre font-mono text-slate-700"
										style={{
											fontSize: `${JSON_FONT_SIZE_PX}px`,
											lineHeight: `${JSON_LINE_HEIGHT_PX}px`,
										}}
									>
										{content}
									</pre>
								)}
							</div>
						</div>
					</div>
				</div>
				{docsEnabled && tooltip ? (
					<div
						className="pointer-events-none fixed z-10 max-w-64 rounded-xl border border-slate-200 bg-slate-900/95 px-3 py-2 text-xs font-medium leading-5 text-white shadow-lg"
						style={{
							left: tooltip.x,
							top: tooltip.y,
						}}
					>
						<p>{tooltip.doc.description}</p>
						<div className="mt-2 space-y-0.5 text-[11px] text-slate-300">
							{tooltip.doc.fhirMapping ? <p>FHIR: {tooltip.doc.fhirMapping}</p> : null}
							<p>Card. {tooltip.doc.cardinality}</p>
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

export function getCodeDisplayValue(
	keyName: string | number | undefined,
	keys: Array<string | number> | undefined,
	value: unknown,
	parentValue: unknown,
	pathPrefix: string | undefined,
	sourceCodeDisplayMap: SourceCodeDisplayMap,
): string | undefined {
	if (typeof keyName !== 'string') {
		return undefined;
	}

	if (keyName === 'code' && isJsonObject(parentValue)) {
		const displayValue = parentValue.display;

		if (typeof displayValue === 'string' && displayValue.length > 0) {
			return displayValue;
		}
	}

	if (typeof value !== 'string' || value.length === 0) {
		return undefined;
	}

	const fieldPath = getFieldPath(keys, keyName, pathPrefix);
	return sourceCodeDisplayMap[`${fieldPath}:${value}`];
}

export function getSourceResourceLinkTarget(
	keyName: string | number | undefined,
	keys: Array<string | number> | undefined,
	value: unknown,
	parentValue: unknown,
	pathPrefix?: string,
	sourceFieldDocs: Record<string, SourceFieldDocRecord> = {},
): string | undefined {
	if (typeof keyName !== 'string' || typeof value !== 'string' || value.length === 0) {
		return undefined;
	}

	const fieldPath = getFieldPath(keys, keyName, pathPrefix);
	const doc = getSourceFieldDoc(sourceFieldDocs, fieldPath, keyName);

	if (!doc?.reference) {
		return undefined;
	}

	if (Array.isArray(doc.reference)) {
		const resolvedReference = resolvePolymorphicReferenceType(keyName, parentValue, doc.reference);
		return resolvedReference ? `${resolvedReference}/${value}` : undefined;
	}

	return `${doc.reference.toLowerCase()}/${value}`;
}

function hasTrailingComma(keyName: string | number | undefined, parentValue: unknown): boolean {
	if (Array.isArray(parentValue) && typeof keyName === 'number') {
		return keyName < parentValue.length - 1;
	}

	if (!isJsonObject(parentValue) || typeof keyName !== 'string') {
		return false;
	}

	const keys = Object.keys(parentValue);
	const keyIndex = keys.indexOf(keyName);

	return keyIndex !== -1 && keyIndex < keys.length - 1;
}

function resolvePolymorphicReferenceType(
	keyName: string,
	parentValue: unknown,
	candidates: string[],
): string | undefined {
	if (!isJsonObject(parentValue)) {
		return undefined;
	}

	const typeFieldName = keyName.endsWith('Id') ? `${keyName.slice(0, -2)}Type` : `${keyName}Type`;
	const rawTypeValue = parentValue[typeFieldName];

	if (typeof rawTypeValue !== 'string' || rawTypeValue.length === 0) {
		return undefined;
	}

	const normalizedTypeValue = rawTypeValue.toLowerCase();
	const resolvedCandidate = candidates.find((candidate) => candidate.toLowerCase() === normalizedTypeValue);

	return resolvedCandidate?.toLowerCase();
}

function formatSourceResourceKeyAnnotation(sourceKey: string): string {
	const [resourceType, resourceId] = sourceKey.split('/');

	if (!resourceType || !resourceId) {
		return sourceKey;
	}

	return `${formatSourceResourceType(resourceType)}/${resourceId}`;
}

interface TooltipState {
	doc: SourceFieldDocRecord;
	x: number;
	y: number;
}

interface RenderedJsonLine {
	element: HTMLElement;
	text: string;
}

function syncInteractiveCursors(root: Element) {
	for (const element of root.querySelectorAll('[data-json-generated-cursor="true"]')) {
		element.classList.remove('cursor-pointer');
		element.removeAttribute('data-json-generated-cursor');
	}

	for (const arrow of root.querySelectorAll('.w-rjv-arrow')) {
		arrow.classList.add('cursor-pointer');
		arrow.setAttribute('data-json-generated-cursor', 'true');
	}

	for (const element of root.querySelectorAll('.w-rjv-inner > span')) {
		if (!(element instanceof HTMLElement)) {
			continue;
		}

		if (!element.querySelector('.w-rjv-arrow')) {
			continue;
		}

		element.classList.add('cursor-pointer');
		element.setAttribute('data-json-generated-cursor', 'true');
	}
}

function syncRenderedJsonCommas(root: Element) {
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

	if (closeElement instanceof HTMLElement && isRenderedElementVisible(closeElement)) {
		return closeElement;
	}

	return openElement instanceof HTMLElement ? openElement : null;
}

function isRenderedElementVisible(element: HTMLElement): boolean {
	return element.getClientRects().length > 0 && window.getComputedStyle(element).display !== 'none';
}

function collectRenderedJsonLines(root: Element): RenderedJsonLine[] {
	const lines: RenderedJsonLine[] = [];

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
		}
	}

	visit(root, 0);
	return lines;
}

function findClosestLineElement(node: Node | null, lines: RenderedJsonLine[]): HTMLElement | null {
	let current: Node | null = node;

	while (current) {
		if (current instanceof HTMLElement && lines.some((line) => line.element === current)) {
			return current;
		}
		current = current.parentNode;
	}

	return null;
}

function JsonViewerToolbar({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
	return (
		<div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur">
			<button
				type="button"
				onClick={onCopy}
				className="pointer-events-auto rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
			>
				{copied ? '已複製' : '複製'}
			</button>
		</div>
	);
}

function DocumentedKeyName({
	props,
	keyName,
	keys,
	parentValue,
	pathPrefix,
	docsEnabled,
	sourceFieldDocs,
	onShowTooltip,
	onHideTooltip,
}: {
	props: Record<string, unknown>;
	keyName: string | number | undefined;
	keys: Array<string | number> | undefined;
	parentValue: unknown;
	pathPrefix?: string;
	docsEnabled: boolean;
	sourceFieldDocs: Record<string, SourceFieldDocRecord>;
	onShowTooltip: (event: MouseEvent<HTMLSpanElement>, doc: SourceFieldDocRecord) => void;
	onHideTooltip: () => void;
}) {
	const spanProps = props as HTMLAttributes<HTMLSpanElement>;

	if (Array.isArray(parentValue) && typeof keyName === 'number') {
		return <span {...spanProps} style={{ display: 'none' }} />;
	}

	if (typeof keyName !== 'string') {
		return <span {...spanProps}>{String(keyName ?? '')}</span>;
	}

	if (!docsEnabled) {
		return <span {...spanProps}>{keyName}</span>;
	}

	const path = getFieldPath(keys, keyName, pathPrefix);
	const doc = getSourceFieldDoc(sourceFieldDocs, path, keyName);

	if (!doc) {
		return <span {...spanProps}>{keyName}</span>;
	}

	return (
		<span
			{...spanProps}
			className="cursor-pointer rounded decoration-dotted underline-offset-4 hover:bg-sky-100 hover:text-sky-900 hover:underline hover:decoration-sky-400"
			onMouseEnter={(event) => onShowTooltip(event, doc)}
			onMouseLeave={onHideTooltip}
		>
			{keyName}
		</span>
	);
}
