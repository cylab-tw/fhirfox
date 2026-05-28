import { JsonViewerCopyButton } from './JsonViewerCopyButton.tsx';
import { JsonViewerExtensions } from './types.ts';
import { JsonViewerTooltip } from './JsonViewerTooltip.tsx';
import { JsonViewerViewPane } from './JsonViewerViewPane.tsx';
import { twMerge } from 'tailwind-merge';
import { useJsonViewerContentState } from './hooks/useJsonViewerContentState.ts';
import { useJsonViewerTooltip } from './hooks/useJsonViewerTooltip.ts';

/** Props for generic JSON viewer. */
export interface JsonViewerProps {
	/** Optional CSS class for root container. */
	className?: string;
	/** Optional extension resolvers from host domain. */
	extensions?: JsonViewerExtensions;
	/** Any JSON-like value. */
	value: object | undefined;
}

export function JsonViewer({ className, extensions, value }: JsonViewerProps) {
	const { copied, viewerSeed, content, copyContent } = useJsonViewerContentState(value);
	const { tooltip, hideTooltip, showTooltip } = useJsonViewerTooltip(typeof extensions?.resolveFieldDoc === 'function');

	return (
		<div
			className={twMerge(
				'relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-lg',
				className,
			)}
		>
			{/* Toolbar */}
			<div className="pointer-events-none absolute top-2 right-3 z-10 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur sm:top-3 sm:right-6">
				<JsonViewerCopyButton copied={copied} onCopy={copyContent} />
			</div>

			{/* View Pane */}
			<JsonViewerViewPane
				key={viewerSeed}
				className="flex-1 overflow-auto"
				content={content}
				extensions={extensions}
				value={value}
				showTooltip={showTooltip}
				hideTooltip={hideTooltip}
			/>

			{/* Tooltip */}
			{tooltip && <JsonViewerTooltip tooltip={tooltip} />}
		</div>
	);
}
