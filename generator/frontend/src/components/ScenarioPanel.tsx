import { Icon } from '@iconify/react';
import ReactMarkdown from 'react-markdown';
import chevronDown from '@iconify-icons/mdi/chevron-down';
import closeIcon from '@iconify-icons/mdi/close';
import helpCircleOutline from '@iconify-icons/mdi/help-circle-outline';

import { formatSourceResourceType } from '../lib/source-resource-display.js';
import { readSourceResourceType } from '@fhirfox/converter/browser';

import type { ScenarioLevelDefinition, ScenarioRecord, ScenarioResultRecord, SourceFieldDocRecord } from '../types.js';
import type { ResourceRelationGraph, ResourceGraphTree } from '@fhirfox-generator/dataset';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface ScenarioPanelProps {
	levelDefinitions: ScenarioLevelDefinition[];
	scenarios: ScenarioRecord[];
	selectedScenarioId: string;
	selectedScenario: ScenarioRecord | null;
	selectedScenarioResult: ScenarioResultRecord | null;
	sourceFieldDocs: Record<string, SourceFieldDocRecord>;
	scenarioSeed: string;
	seedEditable: boolean;
	onScenarioChange: (scenarioId: string) => void;
	onScenarioSeedChange: (seed: string) => void;
	onResourceTypeSelect: (resourceType: string) => void;
	resourceSelectionEnabled: boolean;
	activeResourceType?: string | null;
}

export function ScenarioPanel(props: ScenarioPanelProps) {
	const [isLevelModalOpen, setIsLevelModalOpen] = useState(false);

	return (
		<>
			<section className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
				<div className="shrink-0 border-b border-slate-200/80 px-6 py-5">
					<h2 className="text-2xl font-semibold tracking-tight text-slate-950">FHIRfox</h2>
				</div>

				<div className="shrink-0 border-b border-slate-200/80 px-6 py-5">
					<ScenarioSelectControl
						levelDefinitions={props.levelDefinitions}
						scenarios={props.scenarios}
						selectedScenarioId={props.selectedScenarioId}
						selectedScenario={props.selectedScenario}
						onScenarioChange={props.onScenarioChange}
					/>
					{props.seedEditable ? (
						<SeedControl scenarioSeed={props.scenarioSeed} onScenarioSeedChange={props.onScenarioSeedChange} />
					) : null}
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
					<div className="px-6 py-6 pr-5">
						<ScenarioContextSections {...props} mobile={false} onLevelInfoOpen={() => setIsLevelModalOpen(true)} />
					</div>
				</div>
			</section>
			<LevelDefinitionsModal
				open={isLevelModalOpen}
				levelDefinitions={props.levelDefinitions}
				selectedLevel={props.selectedScenario?.level}
				onClose={() => setIsLevelModalOpen(false)}
			/>
		</>
	);
}

export function ScenarioMobileHeader(props: ScenarioPanelProps) {
	return (
		<section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:rounded-[28px]">
			<div className="border-b border-slate-200/80 px-4 py-4 sm:px-6 sm:py-5">
				<h1 className="text-[22px] font-semibold tracking-tight text-slate-950 sm:text-2xl">FHIRfox</h1>
			</div>
			<div className="px-4 py-4 sm:px-6 sm:py-5">
				<ScenarioSelectControl
					levelDefinitions={props.levelDefinitions}
					scenarios={props.scenarios}
					selectedScenarioId={props.selectedScenarioId}
					selectedScenario={props.selectedScenario}
					onScenarioChange={props.onScenarioChange}
				/>
				{props.seedEditable ? (
					<SeedControl scenarioSeed={props.scenarioSeed} onScenarioSeedChange={props.onScenarioSeedChange} />
				) : null}
			</div>
		</section>
	);
}

export function ScenarioMobileDetails(props: ScenarioPanelProps) {
	const [isLevelModalOpen, setIsLevelModalOpen] = useState(false);

	if (!props.selectedScenario) {
		return (
			<section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:rounded-[28px]">
				<div className="px-6 py-6 text-[15px] leading-7 text-slate-500">
					目前沒有可載入的情境定義。請將情境檔放到 `dataset/scenarios/`，前端就會在 dev/build 時自動讀取。
				</div>
			</section>
		);
	}

	return (
		<>
			<section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:rounded-[28px]">
				<div className="border-b border-slate-200/80 px-4 py-4 sm:px-6">
					<h2 className="text-lg font-semibold tracking-tight text-slate-950">案例資訊</h2>
				</div>
				<div className="divide-y divide-slate-200/80">
					<MobileAccordion title="案例摘要" defaultOpen>
						<ScenarioSummary
							selectedScenario={props.selectedScenario}
							onLevelInfoOpen={() => setIsLevelModalOpen(true)}
						/>
					</MobileAccordion>
					<MobileAccordion title="涵蓋資料">
						<ScenarioCoverage
							selectedScenarioResult={props.selectedScenarioResult}
							sourceFieldDocs={props.sourceFieldDocs}
							onResourceTypeSelect={props.onResourceTypeSelect}
							resourceSelectionEnabled={props.resourceSelectionEnabled}
							activeResourceType={props.activeResourceType}
						/>
					</MobileAccordion>
					{props.selectedScenarioResult?.warnings?.length ? (
						<MobileAccordion title="注意事項">
							<ScenarioWarnings selectedScenarioResult={props.selectedScenarioResult} />
						</MobileAccordion>
					) : null}
					{props.selectedScenario.details ? (
						<MobileAccordion title="情境說明">
							<ScenarioDetails selectedScenario={props.selectedScenario} />
						</MobileAccordion>
					) : null}
				</div>
			</section>
			<LevelDefinitionsModal
				open={isLevelModalOpen}
				levelDefinitions={props.levelDefinitions}
				selectedLevel={props.selectedScenario.level}
				onClose={() => setIsLevelModalOpen(false)}
			/>
		</>
	);
}

function ScenarioSelectControl({
	levelDefinitions,
	scenarios,
	selectedScenarioId,
	selectedScenario,
	onScenarioChange,
}: Pick<
	ScenarioPanelProps,
	'levelDefinitions' | 'scenarios' | 'selectedScenarioId' | 'selectedScenario' | 'onScenarioChange'
>) {
	const selectedScenarioLabel =
		scenarios.find((scenario) => scenario.id === selectedScenarioId)?.displayName ??
		selectedScenario?.displayName ??
		'選擇情境';
	const scenariosByLevel: Array<{ definition: ScenarioLevelDefinition; scenarios: ScenarioRecord[] }> = levelDefinitions
		.map((definition) => ({
			definition,
			scenarios: scenarios.filter((scenario) => scenario.level === definition.level),
		}))
		.filter((group) => group.scenarios.length > 0);
	const scenariosWithoutDefinition = scenarios.filter(
		(scenario) => scenario.level === undefined || getScenarioLevelDefinition(levelDefinitions, scenario.level) === null,
	);

	return (
		<label className="grid gap-2.5">
			<span className="text-sm font-semibold text-slate-900">選擇情境</span>
			<div className="relative">
				<select
					value={selectedScenarioId}
					onChange={(event) => onScenarioChange(event.target.value)}
					title={`${selectedScenarioId} - ${selectedScenarioLabel}`}
					className="w-full appearance-none truncate rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 pr-10 text-[15px] font-medium text-slate-800 transition outline-none focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100 sm:rounded-2xl sm:px-4 sm:pr-11"
				>
					{scenarios.length === 0 ? <option value="">No scenarios available</option> : null}
					{scenariosByLevel.map(({ definition, scenarios: groupedScenarios }) => (
						<optgroup key={definition.level} label={`${definition.label} · ${definition.title}`}>
							{groupedScenarios.map((scenario) => (
								<option key={scenario.id} value={scenario.id}>
									{scenario.id} - {scenario.displayName}
								</option>
							))}
						</optgroup>
					))}
					{scenariosWithoutDefinition.length > 0 ? (
						<optgroup label="其他 Level">
							{scenariosWithoutDefinition.map((scenario) => (
								<option key={scenario.id} value={scenario.id}>
									{scenario.id} - {scenario.displayName}
								</option>
							))}
						</optgroup>
					) : null}
				</select>
				<span className="pointer-events-none absolute inset-y-0 right-4 inline-flex items-center text-slate-400">
					<Icon icon={chevronDown} className="h-5 w-5" />
				</span>
			</div>
		</label>
	);
}

function SeedControl({
	scenarioSeed,
	onScenarioSeedChange,
}: {
	scenarioSeed: string;
	onScenarioSeedChange: (seed: string) => void;
}) {
	return (
		<label className="mt-4 grid gap-2.5">
			<span className="text-sm font-semibold text-slate-900">Seed</span>
			<input
				type="text"
				value={scenarioSeed}
				onChange={(event) => onScenarioSeedChange(event.target.value)}
				placeholder="1234"
				className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-[15px] font-medium text-slate-800 transition outline-none focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100 sm:rounded-2xl sm:px-4"
			/>
			<p className="text-xs leading-5 text-slate-500">變更 seed 會重新解析目前情境。</p>
		</label>
	);
}

function ScenarioContextSections(props: ScenarioPanelProps & { mobile: boolean; onLevelInfoOpen?: () => void }) {
	if (!props.selectedScenario) {
		return (
			<p className="text-[15px] leading-7 text-slate-500">
				目前沒有可載入的情境定義。請將情境檔放到 `dataset/scenarios/`，前端就會在 dev/build 時自動讀取。
			</p>
		);
	}

	return (
		<div className="grid gap-6">
			<Section title="案例摘要" mobile={props.mobile}>
				<ScenarioSummary selectedScenario={props.selectedScenario} onLevelInfoOpen={props.onLevelInfoOpen} />
			</Section>

			<Section title="涵蓋資料" mobile={props.mobile}>
				<ScenarioCoverage
					selectedScenarioResult={props.selectedScenarioResult}
					sourceFieldDocs={props.sourceFieldDocs}
					onResourceTypeSelect={props.onResourceTypeSelect}
					resourceSelectionEnabled={props.resourceSelectionEnabled}
					activeResourceType={props.activeResourceType}
				/>
			</Section>

			{props.selectedScenarioResult?.warnings?.length ? (
				<Section title="注意事項" mobile={props.mobile}>
					<ScenarioWarnings selectedScenarioResult={props.selectedScenarioResult} />
				</Section>
			) : null}

			{props.selectedScenario.details ? (
				<Section title="情境說明" mobile={props.mobile}>
					<ScenarioDetails selectedScenario={props.selectedScenario} />
				</Section>
			) : null}
		</div>
	);
}

function ScenarioSummary({
	selectedScenario,
	onLevelInfoOpen,
}: {
	selectedScenario: ScenarioRecord;
	onLevelInfoOpen?: () => void;
}) {
	const levelLabel = selectedScenario.level !== undefined ? `Level ${selectedScenario.level}` : null;

	return (
		<div className="grid gap-3.5">
			<div className="min-w-0">
				<h3 className="text-[22px] leading-tight font-semibold text-slate-950">{selectedScenario.displayName}</h3>
				<p className="mt-1 text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">{selectedScenario.id}</p>
			</div>
			<div className="flex flex-wrap gap-2">
				{levelLabel ? <LevelInfoTrigger levelLabel={levelLabel} onClick={onLevelInfoOpen} /> : null}
				<Pill tone="accent">{selectedScenario.type}</Pill>
			</div>
			<p className="text-[15px] leading-7 text-slate-600">{selectedScenario.summary ?? '目前沒有額外的情境摘要。'}</p>
		</div>
	);
}

function LevelInfoTrigger({ levelLabel, onClick }: { levelLabel: string; onClick?: () => void }) {
	if (!onClick) {
		return <Pill>{levelLabel}</Pill>;
	}

	return (
		<button
			type="button"
			onClick={onClick}
			aria-label="查看測試情境分級說明"
			title="查看測試情境分級說明"
			className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-900 focus-visible:ring-4 focus-visible:ring-sky-100 focus-visible:outline-none"
		>
			<span>{levelLabel}</span>
			<span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full text-slate-500">
				<Icon icon={helpCircleOutline} className="h-3.5 w-3.5" />
			</span>
		</button>
	);
}

function ScenarioCoverage({
	selectedScenarioResult,
	sourceFieldDocs,
	onResourceTypeSelect,
	resourceSelectionEnabled,
	activeResourceType,
}: Pick<
	ScenarioPanelProps,
	'selectedScenarioResult' | 'sourceFieldDocs' | 'onResourceTypeSelect' | 'resourceSelectionEnabled' | 'activeResourceType'
>) {
	const resourceEntries = Object.entries(selectedScenarioResult?.resources ?? {});

	return (
		<div className="grid gap-3.5">
			<p className="text-[15px] leading-6 text-slate-600">
				{resourceEntries.length > 0
					? `共 ${resourceEntries.length} 類資源，合計 ${selectedScenarioResult?.meta.totalResources ?? 0} 筆。`
					: '情境尚未完成解析。'}
			</p>
			{resourceEntries.length > 0 ? (
				<ResourceCoverageTree
					selectedScenarioResult={selectedScenarioResult}
					sourceFieldDocs={sourceFieldDocs}
					clickable={resourceSelectionEnabled}
					onResourceTypeSelect={onResourceTypeSelect}
					activeResourceType={activeResourceType ?? null}
				/>
			) : null}
		</div>
	);
}

function ScenarioWarnings({ selectedScenarioResult }: Pick<ScenarioPanelProps, 'selectedScenarioResult'>) {
	return (
		<div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
			<p className="text-[15px] leading-6 text-amber-900">{selectedScenarioResult?.warnings?.join(' ')}</p>
		</div>
	);
}

function ScenarioDetails({ selectedScenario }: { selectedScenario: ScenarioRecord }) {
	return (
		<div className="prose max-w-none text-[15px] leading-7 text-slate-600 prose-slate prose-headings:mt-6 prose-headings:mb-2 prose-p:my-0 prose-a:text-sky-700 prose-strong:text-slate-800 prose-ol:my-2.5 prose-ul:my-2.5 prose-li:my-1.5">
			<ReactMarkdown>{selectedScenario.details ?? ''}</ReactMarkdown>
		</div>
	);
}

function Section({ title, children, mobile }: { title: string; children: ReactNode; mobile: boolean }) {
	return (
		<section
			className={`grid gap-3.5 border-slate-200/80 ${mobile ? '' : 'border-t pt-6 first:border-t-0 first:pt-0'}`}
		>
			<h4 className="text-sm font-semibold tracking-[0.02em] text-slate-900">{title}</h4>
			{children}
		</section>
	);
}

function MobileAccordion({
	title,
	children,
	defaultOpen = false,
}: {
	title: string;
	children: ReactNode;
	defaultOpen?: boolean;
}) {
	return (
		<details className="group px-4 py-4 sm:px-6" open={defaultOpen}>
			<summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-900 marker:content-none">
				<span>{title}</span>
				<span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500 transition group-open:-rotate-180">
					⌄
				</span>
			</summary>
			<div className="pt-4">{children}</div>
		</details>
	);
}

function Pill({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'accent' }) {
	return (
		<span
			className={[
				'rounded-full border px-3 py-1.5 text-xs font-semibold',
				tone === 'accent' ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-slate-200 bg-slate-50 text-slate-700',
			].join(' ')}
		>
			{children}
		</span>
	);
}

function LevelDefinitionsModal({
	open,
	levelDefinitions,
	selectedLevel,
	onClose,
}: {
	open: boolean;
	levelDefinitions: ScenarioLevelDefinition[];
	selectedLevel?: number;
	onClose: () => void;
}) {
	useEffect(() => {
		if (!open || typeof document === 'undefined') {
			return;
		}

		const originalOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose();
			}
		};

		window.addEventListener('keydown', handleKeyDown);

		return () => {
			document.body.style.overflow = originalOverflow;
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, [onClose, open]);

	if (!open) {
		return null;
	}

	const selectedDefinition = getScenarioLevelDefinition(levelDefinitions, selectedLevel);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/28 px-3 py-4 sm:px-4 sm:py-6" onClick={onClose}>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="scenario-levels-title"
				className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.24)] sm:rounded-[28px]"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-4 py-4 sm:px-6 sm:py-5">
					<div className="min-w-0">
						<h2 id="scenario-levels-title" className="text-[22px] leading-tight font-semibold tracking-tight text-slate-950 sm:text-[28px]">
							測試情境分級說明
						</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-800 focus-visible:ring-4 focus-visible:ring-sky-100 focus-visible:outline-none"
						aria-label="Close level definitions"
					>
						<Icon icon={closeIcon} className="h-4 w-4" />
					</button>
				</div>
				<div className="max-h-[72dvh] overflow-auto px-4 py-4 sm:px-6 sm:py-5">
					<div className="divide-y divide-slate-200/80">
						{levelDefinitions.map((definition) => (
							<LevelDefinitionRow
								key={definition.level}
								definition={definition}
								isActive={selectedDefinition?.level === definition.level}
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

function LevelDefinitionRow({ definition, isActive }: { definition: ScenarioLevelDefinition; isActive: boolean }) {
	return (
		<div className={['relative py-4 transition first:pt-0 last:pb-0', isActive ? 'text-slate-950' : ''].join(' ')}>
			<div className="relative grid gap-2.5 pl-4 sm:grid-cols-[auto,1fr] sm:gap-x-4 sm:gap-y-1">
				{isActive ? (
					<span className="absolute inset-y-0 left-0 w-[3px] rounded-full bg-sky-300" aria-hidden="true" />
				) : null}
				<div className="pt-0.5">
					<span
						className={[
							'inline-flex rounded-full px-3 py-1 text-xs font-semibold',
							isActive ? 'bg-sky-100 text-sky-900' : 'bg-slate-100 text-slate-700',
						].join(' ')}
					>
						{definition.label}
					</span>
				</div>
				<div className="min-w-0">
					<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
						<h3
							className={[
								'text-[19px] leading-tight font-semibold',
								isActive ? 'text-slate-950' : 'text-slate-900',
							].join(' ')}
						>
							{definition.title}
						</h3>
						<span className="text-[15px] leading-6 text-slate-500">{definition.englishTitle}</span>
					</div>
					<p className={['text-[16px] leading-7', isActive ? 'text-slate-700' : 'text-slate-600'].join(' ')}>
						{definition.description}
					</p>
				</div>
			</div>
		</div>
	);
}

function getScenarioLevelDefinition(
	levelDefinitions: ScenarioLevelDefinition[],
	level?: number,
): ScenarioLevelDefinition | null {
	if (typeof level !== 'number') {
		return null;
	}

	return levelDefinitions.find((entry) => entry.level === level) ?? null;
}

function ResourceCoverageTree({
	selectedScenarioResult,
	sourceFieldDocs,
	clickable,
	onResourceTypeSelect,
	activeResourceType,
}: {
	selectedScenarioResult: ScenarioResultRecord | null;
	sourceFieldDocs: Record<string, SourceFieldDocRecord>;
	clickable: boolean;
	onResourceTypeSelect: (resourceType: string) => void;
	activeResourceType: string | null;
}) {
	const tree = buildCoverageTree(selectedScenarioResult, sourceFieldDocs);

	return (
		<div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-[linear-gradient(180deg,rgba(250,251,253,0.96),rgba(246,248,251,0.92))] px-3 py-3 sm:rounded-[24px] sm:px-4 sm:py-4">
			<div className="grid gap-2">
				{tree.map((node) => (
					<ResourceCoverageTreeNode
						key={node.resourceType}
						node={node}
						clickable={clickable}
						onResourceTypeSelect={onResourceTypeSelect}
						activeResourceType={activeResourceType}
					/>
				))}
			</div>
		</div>
	);
}

export interface CoverageTreeNode {
	resourceType: string;
	count: number;
	children: CoverageTreeNode[];
}

function ResourceCoverageTreeNode({
	node,
	clickable,
	onResourceTypeSelect,
	level = 0,
	isChild = false,
	activeResourceType,
}: {
	node: CoverageTreeNode;
	clickable: boolean;
	onResourceTypeSelect: (resourceType: string) => void;
	level?: number;
	isChild?: boolean;
	activeResourceType: string | null;
}) {
	return (
		<div className="grid gap-2">
			<div className={`relative flex items-center ${isChild ? 'pl-6' : ''}`}>
				{isChild ? (
					<span className="absolute top-[1px] left-0 h-4 w-4 rounded-bl-[10px] border-b-[1.5px] border-l-[1.5px] border-slate-300" />
				) : null}
				<ResourceTreeNodeChip
					resourceType={node.resourceType}
					count={node.count}
					clickable={clickable}
					active={activeResourceType?.toLowerCase() === node.resourceType.toLowerCase()}
					onClick={() => onResourceTypeSelect(node.resourceType)}
				/>
			</div>
			{node.children.length > 0 ? (
				<div className={`ml-[11px] grid gap-2 border-l-[1.5px] border-slate-300 pl-5 ${level === 0 ? 'pt-1' : ''}`}>
					{node.children.map((child) => (
						<ResourceCoverageTreeNode
							key={`${node.resourceType}-${child.resourceType}`}
							node={child}
							clickable={clickable}
							onResourceTypeSelect={onResourceTypeSelect}
							activeResourceType={activeResourceType}
							level={level + 1}
							isChild
						/>
					))}
				</div>
			) : null}
		</div>
	);
}

function ResourceTreeNodeChip({
	resourceType,
	count,
	clickable,
	active,
	onClick,
}: {
	resourceType: string;
	count: number;
	clickable: boolean;
	active: boolean;
	onClick: () => void;
}) {
	const className = [
		'inline-flex min-w-0 items-center gap-1.5 self-start rounded-[18px] px-2.5 py-1.5 text-[13px] font-semibold shadow-[0_4px_12px_rgba(203,213,225,0.18)] transition',
		active
			? 'border border-sky-300 bg-sky-50 text-sky-900 shadow-[0_8px_20px_rgba(186,230,253,0.32)]'
			: 'border border-slate-200/90 bg-white text-slate-800',
	].join(' ');

	const content = (
		<>
			<span>{formatSourceResourceType(resourceType)}</span>
			<span
				className={[
					'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
					active ? 'bg-sky-100 text-sky-700' : 'bg-slate-50 text-slate-400',
				].join(' ')}
			>
				{count}
			</span>
		</>
	);

	if (!clickable) {
		return <span className={className}>{content}</span>;
	}

	return (
		<button
			type="button"
			onClick={onClick}
			data-resource-jump-trigger="true"
			className={`${className} hover:-translate-y-0.5 hover:border-sky-200 hover:text-sky-900 hover:shadow-[0_8px_18px_rgba(186,230,253,0.22)] focus-visible:ring-4 focus-visible:ring-sky-100 focus-visible:outline-none`}
		>
			{content}
		</button>
	);
}

export function buildCoverageTree(
	selectedScenarioResult: ScenarioResultRecord | null,
	sourceFieldDocs: Record<string, SourceFieldDocRecord>,
): CoverageTreeNode[] {
	if (!selectedScenarioResult) {
		return [];
	}

	if (selectedScenarioResult.graph?.tree) {
		return buildCoverageTreeFromInstanceTree(selectedScenarioResult.graph.tree);
	}

	return buildCoverageTreeFromScenarioResult(selectedScenarioResult, sourceFieldDocs);
}

function buildCoverageTreeFromInstanceTree(tree: ResourceGraphTree[]): CoverageTreeNode[] {
	const resourceCounts = new Map<string, number>();
	const childrenByType = new Map<string, Set<string>>();
	const incomingTypes = new Set<string>();
	const firstSeenOrder = new Map<string, number>();
	let orderIndex = 0;

	function traverse(nodes: ResourceGraphTree[], parentType: string | null) {
		for (const node of nodes) {
			const type = node.resourceType;
			resourceCounts.set(type, (resourceCounts.get(type) ?? 0) + 1);

			if (!firstSeenOrder.has(type)) {
				firstSeenOrder.set(type, orderIndex++);
			}

			if (parentType) {
				const children = childrenByType.get(parentType) ?? new Set<string>();
				children.add(type);
				childrenByType.set(parentType, children);
				incomingTypes.add(type);
			}

			traverse(node.children, type);
		}
	}

	traverse(tree, null);

	return buildCoverageTreeFromCountsAndAdjacency(resourceCounts, childrenByType, incomingTypes, firstSeenOrder);
}

function buildCoverageTreeFromScenarioResult(
	selectedScenarioResult: ScenarioResultRecord,
	sourceFieldDocs: Record<string, SourceFieldDocRecord>,
): CoverageTreeNode[] {
	const resourceCounts = new Map<string, number>();
	const childrenByType = new Map<string, Set<string>>();
	const incomingTypes = new Set<string>();
	const firstSeenOrder = new Map<string, number>();
	const idToResourceType = new Map<string, string>();

	for (const [index, resource] of selectedScenarioResult.orderedResources.entries()) {
		const resourceType = readSourceResourceType(resource);
		resourceCounts.set(resourceType, (resourceCounts.get(resourceType) ?? 0) + 1);
		if (!firstSeenOrder.has(resourceType)) {
			firstSeenOrder.set(resourceType, index);
		}

		const id = typeof resource.id === 'string' ? resource.id : null;
		if (id) {
			idToResourceType.set(id, resourceType);
			idToResourceType.set(`${resourceType}/${id}`, resourceType);
		}
	}

	for (const resource of selectedScenarioResult.orderedResources) {
		const sourceType = readSourceResourceType(resource);
		for (const [field, value] of Object.entries(resource)) {
			const doc = sourceFieldDocs[`${sourceType}.${field}`];
			const targetTypes = readReferenceTypes(doc?.reference);

			if (targetTypes.length === 0) {
				continue;
			}

			for (const targetId of readReferenceValues(value)) {
				const targetType = idToResourceType.get(targetId) ?? idToResourceType.get(targetId.split('/').pop() ?? '');

				if (!targetType || !targetTypes.some((candidate) => candidate.toLowerCase() === targetType.toLowerCase())) {
					continue;
				}

				const children = childrenByType.get(sourceType) ?? new Set<string>();
				children.add(targetType);
				childrenByType.set(sourceType, children);
				incomingTypes.add(targetType);
			}
		}
	}

	return buildCoverageTreeFromCountsAndAdjacency(resourceCounts, childrenByType, incomingTypes, firstSeenOrder);
}

function buildCoverageTreeFromCountsAndAdjacency(
	resourceCounts: Map<string, number>,
	childrenByType: Map<string, Set<string>>,
	incomingTypes: Set<string>,
	firstSeenOrder: Map<string, number>,
): CoverageTreeNode[] {
	const sortedTypes = [...resourceCounts.keys()].sort(
		(left, right) => (firstSeenOrder.get(left) ?? 0) - (firstSeenOrder.get(right) ?? 0) || left.localeCompare(right),
	);
	const roots = sortedTypes.filter((resourceType) => !incomingTypes.has(resourceType));
	const assigned = new Set<string>();
	const visiting = new Set<string>();

	function buildNode(resourceType: string): CoverageTreeNode | null {
		const count = resourceCounts.get(resourceType);

		if (!count || assigned.has(resourceType) || visiting.has(resourceType)) {
			return null;
		}

		visiting.add(resourceType);
		assigned.add(resourceType);
		const children = [...(childrenByType.get(resourceType) ?? [])]
			.sort((left, right) => (firstSeenOrder.get(left) ?? 0) - (firstSeenOrder.get(right) ?? 0) || left.localeCompare(right))
			.map((childType) => buildNode(childType))
			.filter((child): child is CoverageTreeNode => child !== null);
		visiting.delete(resourceType);

		return {
			resourceType,
			count,
			children,
		};
	}

	const tree = roots.map((resourceType) => buildNode(resourceType)).filter((node): node is CoverageTreeNode => node !== null);

	for (const resourceType of sortedTypes) {
		if (assigned.has(resourceType)) {
			continue;
		}

		const node = buildNode(resourceType);
		if (node) {
			tree.push(node);
		}
	}

	return tree;
}

function readReferenceTypes(value: string | string[] | undefined): string[] {
	if (!value) {
		return [];
	}

	return Array.isArray(value) ? value : [value];
}

function readReferenceValues(value: unknown): string[] {
	if (typeof value === 'string') {
		return value.length > 0 ? [value] : [];
	}

	if (Array.isArray(value)) {
		return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
	}

	return [];
}
