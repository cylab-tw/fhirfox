import { useI18n } from '../../i18n.js';

export function JsonViewerCopyButton({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
	const { t } = useI18n();

	return (
		<button
			type="button"
			onClick={onCopy}
			className="pointer-events-auto rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
		>
			{copied ? t('copied') : t('copy')}
		</button>
	);
}
