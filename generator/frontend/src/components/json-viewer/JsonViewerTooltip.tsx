import type { JsonViewerTooltipState } from './types.ts';

export function JsonViewerTooltip({ tooltip }: { tooltip: JsonViewerTooltipState }) {
	return (
		<div
			className="pointer-events-none fixed z-10 max-w-64 rounded-xl border border-slate-200 bg-slate-900/95 px-3 py-2 text-xs leading-5 font-medium text-white shadow-lg"
			style={{ left: tooltip.x, top: tooltip.y }}
		>
			<p>{tooltip.doc.description}</p>

			<div className="mt-2 space-y-0.5 text-[11px] text-slate-300">
				{tooltip.doc.metadata?.map((item) => (
					<p key={`${item.label}:${item.value}`}>
						<span>{item.label}</span>: <span>{item.value}</span>
					</p>
				))}
			</div>
		</div>
	);
}
