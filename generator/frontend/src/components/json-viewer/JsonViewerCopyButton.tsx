export function JsonViewerCopyButton({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
	return (
		<button
			type="button"
			onClick={onCopy}
			className="pointer-events-auto rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
		>
			{copied ? '已複製' : '複製'}
		</button>
	);
}
