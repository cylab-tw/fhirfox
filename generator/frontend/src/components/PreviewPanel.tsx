import type { PropsWithChildren } from 'react';

import type { OutputTab, PreviewMode } from '../types.js';

const tabs: Array<{ value: OutputTab; label: string }> = [
	{ value: 'simplified', label: '來源資料' },
	{ value: 'fhir', label: 'FHIR 輸出' },
];

const previewModes: Array<{ value: PreviewMode; label: string }> = [
	{ value: 'resource', label: '資源檢視' },
	{ value: 'document', label: '完整 JSON' },
];

const segmentedGroupClassName =
	'inline-flex rounded-2xl border border-slate-300 bg-slate-100 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]';
const primarySegmentButtonClassName =
	'rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100';
const inactiveSegmentClassName = 'text-slate-600 hover:text-slate-900';

export function PreviewPanel({
	scenarioId,
	scenarioName,
	activeTab,
	onTabChange,
	previewMode,
	onPreviewModeChange,
	helperText,
	compactMeta,
	children,
}: PropsWithChildren<{
	scenarioId?: string;
	scenarioName?: string;
	activeTab: OutputTab;
	onTabChange: (tab: OutputTab) => void;
	previewMode: PreviewMode;
	onPreviewModeChange: (mode: PreviewMode) => void;
	helperText?: string;
	compactMeta: string[];
}>) {
	return (
		<section className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
			<div className="shrink-0 border-b border-slate-200/80 px-6 py-5">
				<div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-4 sm:gap-y-3.5">
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
							<h2 className="text-[22px] font-semibold tracking-tight text-slate-950">{scenarioName ?? '資料檢視'}</h2>
							{scenarioId ? (
								<span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
									{scenarioId}
								</span>
							) : null}
						</div>
						<div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[15px] text-slate-500">
							{compactMeta.map((item, index) => (
								<span key={item} className="inline-flex items-center gap-2">
									{index > 0 ? <span className="text-slate-300">·</span> : null}
									<span>{item}</span>
								</span>
							))}
						</div>
						{helperText ? <p className="mt-2.5 text-[15px] leading-6 text-slate-500">{helperText}</p> : null}
					</div>
					<div className="flex w-full shrink-0 flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
						<div className={`${segmentedGroupClassName} w-full sm:w-auto`}>
							{tabs.map((tab) => (
								<button
									key={tab.value}
									type="button"
									role="tab"
									aria-selected={activeTab === tab.value}
									className={[
										`${primarySegmentButtonClassName} flex-1 sm:flex-none`,
										activeTab === tab.value
											? 'border border-slate-300 bg-white text-slate-950 shadow-sm'
											: inactiveSegmentClassName,
									].join(' ')}
									onClick={() => onTabChange(tab.value)}
								>
									{tab.label}
								</button>
							))}
						</div>
						<div className={`${segmentedGroupClassName} w-full sm:w-auto`}>
							{previewModes.map((mode) => (
								<button
									key={mode.value}
									type="button"
									aria-pressed={previewMode === mode.value}
									className={[
										`${primarySegmentButtonClassName} flex-1 sm:flex-none`,
										previewMode === mode.value
											? 'border border-slate-300 bg-white text-slate-950 shadow-sm'
											: inactiveSegmentClassName,
									].join(' ')}
									onClick={() => onPreviewModeChange(mode.value)}
								>
									{mode.label}
								</button>
							))}
						</div>
					</div>
				</div>
			</div>
			<div className="min-h-0 flex-1 overflow-hidden">{children}</div>
		</section>
	);
}
