import { JSON_GUTTER_WIDTH_REM, JSON_INDENT, JSON_LINE_HEIGHT_PX, jsonViewerTheme } from './theme.ts';
import { useCallback, useRef } from 'react';
import JsonView from '@uiw/react-json-view';
import { hasTrailingComma } from './helpers/hasTrailingComma.ts';
import { useJsonViewerLineNumbers } from './hooks/useJsonViewerLineNumbers.ts';
import { useJsonViewerSelectionCopy } from './hooks/useJsonViewerSelectionCopy.ts';

import type { JsonViewerExtensions, JsonViewerFieldDoc } from './types.ts';
import type { SymbolsElement, SymbolsElementResult } from '@uiw/react-json-view';
import type { MouseEvent } from 'react';

export interface JsonViewerViewPaneProps {
	/** Optional CSS class for root container. */
	className?: string;
	/** Formatted JSON source string (JSON.stringify(value, null, 2)). */
	content: string;
	/** Optional extension resolvers from host domain. */
	extensions?: JsonViewerExtensions;
	/** Any JSON-like value. */
	value: object | undefined;
	/** Show tooltip for a documented field key. */
	showTooltip?: (event: MouseEvent<HTMLElement>, doc: JsonViewerFieldDoc) => void;
	/** Hide tooltip immediately. */
	hideTooltip?: () => void;
}

export function JsonViewerViewPane({
	className,
	content,
	extensions,
	value,
	showTooltip,
	hideTooltip,
}: JsonViewerViewPaneProps) {
	const jsonViewRef = useRef<HTMLDivElement>(null);
	const { lineNumbers } = useJsonViewerLineNumbers(content, jsonViewRef);
	const { onCopyCapture } = useJsonViewerSelectionCopy(jsonViewRef);

	const renderColon = useCallback((props: SymbolsElement, result: SymbolsElementResult<object, unknown>) => {
		const ctx = { ...result };

		// Hide array index
		if (Array.isArray(ctx.parentValue) && typeof ctx.keyName === 'number') {
			return <span className="hidden" />;
		}

		return <span {...props} />;
	}, []);

	const renderKeyName = useCallback(
		(props: SymbolsElement, result: SymbolsElementResult<object>) => {
			const ctx = { ...result };

			// Hide array index
			if (Array.isArray(result.parentValue) && typeof ctx.keyName === 'number') {
				return <span className="hidden" />;
			}

			const doc = extensions?.resolveFieldDoc?.(result);

			return (
				<span
					{...props}
					className={doc ? 'rounded-xs transition-colors duration-75 hover:bg-sky-200 hover:text-sky-900' : ''}
					onMouseEnter={doc && showTooltip ? (event) => showTooltip(event, doc) : undefined}
					onMouseLeave={doc && hideTooltip ? hideTooltip : undefined}
				>
					{String(result.keyName ?? '')}
				</span>
			);
		},
		[extensions, hideTooltip, showTooltip],
	);

	const renderRow = useCallback(
		(props: SymbolsElement<'div'>, result: SymbolsElementResult<object>) => {
			const ctx = { ...result };

			const annotations = extensions?.resolveAnnotations?.(ctx);

			return (
				<div {...props}>
					{props.children}

					{hasTrailingComma(ctx) ? <span className="text-slate-400">,</span> : null}

					{annotations?.map((annotation, index) => {
						const key = annotation.key ?? `${annotation.type}-${index}`;

						switch (annotation.type) {
							case 'button':
								return (
									<button
										key={key}
										type="button"
										className="ml-2 inline text-xs leading-5 font-normal text-slate-500/90 italic underline-offset-2 select-none hover:underline hover:decoration-slate-400/90"
										title={annotation.title}
										onClick={(event) => {
											event.stopPropagation();
											extensions?.onAnnotationClick?.(annotation, ctx);
										}}
									>
										{annotation.label}
									</button>
								);

							case 'text':
								return (
									<span
										key={key}
										className="ml-2 inline text-xs leading-5 font-normal text-slate-500/90 italic select-none"
										title={annotation.title}
									>
										{annotation.text}
									</span>
								);
						}
					})}
				</div>
			);
		},
		[extensions],
	);

	return (
		<div className={className} onScrollCapture={hideTooltip}>
			<div
				className="grid min-h-full grid-cols-2"
				style={{ gridTemplateColumns: `${JSON_GUTTER_WIDTH_REM}rem minmax(0, 1fr)` }}
			>
				<div className="flex flex-col border-r border-slate-200/70 px-1.5 pt-3 pb-5 sm:px-2.5">
					{lineNumbers.map((lineNumber) => (
						<div
							key={lineNumber}
							className="text-right font-mono text-xs font-medium text-slate-400 select-none"
							style={{ lineHeight: `${JSON_LINE_HEIGHT_PX}px` }}
						>
							{lineNumber}
						</div>
					))}
				</div>

				<div className="min-h-full min-w-max px-3 pt-3 pb-5 sm:px-4" onCopyCapture={onCopyCapture}>
					<JsonView
						ref={jsonViewRef}
						value={value}
						indentWidth={JSON_INDENT}
						displayObjectSize={false}
						displayDataTypes={false}
						enableClipboard={false}
						collapsed={false}
						highlightUpdates={false}
						shortenTextAfterLength={0}
						style={jsonViewerTheme}
					>
						<JsonView.Colon render={renderColon} />
						<JsonView.KeyName render={renderKeyName} />
						<JsonView.Row render={renderRow} />
					</JsonView>
				</div>
			</div>
		</div>
	);
}
