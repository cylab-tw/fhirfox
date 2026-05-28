import { useEffect, useMemo, useRef, useState } from 'react';
import { manifest as appManifest } from 'virtual:fhirfox-manifest';

import { buildScenarioPath, getScenarioRouteState, restoreRedirectedScenarioPath } from './lib/scenario-route.js';
import { createScenarioBrowserDataSource } from './create-data-source.js';
import { formatSourceDocumentResources } from './lib/source-resource-display.js';

import { getBundlePreviewResourceItemsWithDisplays, getSourcePreviewResourceItems } from './lib/resource-preview.js';
import { getEmptyPreviewMessage, getPreviewHelperText } from './lib/preview-panel.js';

import { PreviewPanel } from './components/PreviewPanel.js';

import { ScenarioMobileDetails, ScenarioMobileHeader, ScenarioPanel } from './components/ScenarioPanel.js';

import { ScenarioPreviewContent } from './components/ScenarioPreviewContent.js';

import { StatusCard } from './components/StatusCard.js';

import { useScenarioBrowser } from './hooks/use-scenario-browser.js';

import type {
	AppManifest,
	OutputTab,
	PreviewMode,
	ResourceJumpContext,
	ResourceJumpScrollBehavior,
	ResourceJumpTarget,
	ViewContext,
} from './types.js';

const manifest = appManifest as AppManifest;
const defaultBackendSeed = manifest.dataSource.kind === 'backend' ? (manifest.dataSource.defaultSeed ?? '1234') : null;

export default function ScenarioBrowserApp() {
	const dataSource = useMemo(() => createScenarioBrowserDataSource(manifest), []);
	const [routeState, setRouteState] = useState(() =>
		getScenarioRouteState(
			typeof window === 'undefined' ? '/' : window.location.pathname,
			typeof window === 'undefined' ? '' : window.location.search,
			defaultBackendSeed,
		),
	);
	const [activeTab, setActiveTab] = useState<OutputTab>('simplified');
	const [sourcePreviewMode, setSourcePreviewMode] = useState<PreviewMode>('resource');
	const [bundlePreviewMode, setBundlePreviewMode] = useState<PreviewMode>('resource');
	const [resourceJumpTarget, setResourceJumpTarget] = useState<ResourceJumpTarget | null>(null);
	const [activeResourceType, setActiveResourceType] = useState<string | null>(null);
	const [viewContextEpoch, setViewContextEpoch] = useState(0);
	const resourceJumpContextRef = useRef<ResourceJumpContext | null>(null);
	const resourceJumpState = useRef<{ resourceType: string; ordinal: number } | null>(null);
	const scenarioSeed = routeState.seed ?? defaultBackendSeed ?? '';
	const {
		scenarioSource,
		levelDefinitions,
		scenarios,
		sourceFieldDocs,
		sourceCodeDisplayMap,
		selectedScenarioId,
		selectedScenario,
		selectedScenarioResult,
		selectedBundle,
		scenariosLoading,
		scenarioLoading,
		bundleLoading,
		scenariosError,
		scenarioError,
		bundleError,
		setSelectedScenarioId,
	} = useScenarioBrowser(dataSource, routeState.scenarioId, scenarioSeed, activeTab === 'fhir');
	const sourcePreviewResources = useMemo(
		() => getSourcePreviewResourceItems(selectedScenarioResult, sourceCodeDisplayMap),
		[selectedScenarioResult, sourceCodeDisplayMap],
	);
	const bundlePreviewResources = useMemo(
		() => getBundlePreviewResourceItemsWithDisplays(selectedBundle, sourceCodeDisplayMap),
		[selectedBundle, sourceCodeDisplayMap],
	);
	const isSourceTab = activeTab === 'simplified';
	const previewMode = isSourceTab ? sourcePreviewMode : bundlePreviewMode;
	const isResourceMode = previewMode === 'resource';
	const viewContext: ViewContext = {
		activeTab,
		previewMode,
	};

	const previewResources = isSourceTab ? sourcePreviewResources : bundlePreviewResources;
	const previewOutput = isSourceTab
		? selectedScenarioResult?.resources
			? formatSourceDocumentResources(selectedScenarioResult.resources)
			: undefined
		: selectedBundle;
	const previewDocsEnabled = isSourceTab;
	const previewHelperText = getPreviewHelperText(activeTab, previewMode);
	const emptyPreviewMessage = getEmptyPreviewMessage(activeTab, previewMode);
	const canJumpToResource = isResourceMode;
	const resourceJumpScrollBehavior: ResourceJumpScrollBehavior =
		resourceJumpContextRef.current?.activeTab === activeTab &&
		resourceJumpContextRef.current?.previewMode === previewMode &&
		resourceJumpContextRef.current?.epoch === viewContextEpoch
			? 'smooth'
			: 'auto';
	const compactMeta = useMemo(
		() =>
			[
				selectedScenarioResult ? `${selectedScenarioResult.meta.totalResources} source resources` : null,
				selectedBundle ? `${selectedBundle.entry.length} FHIR entries` : null,
				scenarioSeed ? `seed ${scenarioSeed}` : null,
				selectedScenarioResult?.warnings?.length ? `${selectedScenarioResult.warnings.length} warnings` : null,
			].filter((item): item is string => item !== null),
		[selectedBundle, selectedScenarioResult, scenarioSeed],
	);
	const scenarioPanelProps = {
		levelDefinitions,
		scenarios,
		selectedScenarioId,
		selectedScenario,
		selectedScenarioResult,
		sourceFieldDocs,
		scenarioSeed,
		seedEditable: manifest.dataSource.kind === 'backend',
		onScenarioChange: handleScenarioChange,
		onScenarioSeedChange: handleScenarioSeedChange,
		onResourceTypeSelect: handleSourceResourceJump,
		resourceSelectionEnabled: canJumpToResource,
		activeResourceType: isResourceMode ? activeResourceType : null,
	};
	const previewPanelProps = {
		scenarioId: selectedScenario?.id,
		scenarioName: selectedScenario?.displayName,
		activeTab,
		onTabChange: handleTabChange,
		previewMode,
		onPreviewModeChange: handlePreviewModeChange,
		helperText: previewHelperText,
		compactMeta,
	};
	const previewContentProps = {
		isSourceTab,
		isResourceMode,
		scenariosLoading,
		scenarioLoading,
		bundleLoading,
		scenariosError,
		scenarioError,
		bundleError,
		previewResources,
		previewOutput,
		sourceFieldDocs,
		sourceCodeDisplayMap,
		previewDocsEnabled,
		resourceJumpTarget,
		resourceJumpScrollBehavior,
		onSourceResourceSelect: handleSourceResourceSelect,
		onExpandedResourceTypeChange: setActiveResourceType,
		emptyPreviewMessage,
	};

	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}

		if (restoreRedirectedScenarioPath()) {
			setRouteState(getScenarioRouteState(window.location.pathname, window.location.search, defaultBackendSeed));
		}

		const handlePopState = () => {
			setRouteState(getScenarioRouteState(window.location.pathname, window.location.search, defaultBackendSeed));
		};

		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	}, []);

	useEffect(() => {
		if (typeof window === 'undefined' || !selectedScenarioId) {
			return;
		}

		const targetPath = buildScenarioPath(routeState.basePath, selectedScenarioId, scenarioSeed);

		if (`${window.location.pathname}${window.location.search}` !== targetPath) {
			window.history.replaceState(null, '', targetPath);
		}
	}, [routeState.basePath, scenarioSeed, selectedScenarioId]);

	useEffect(() => {
		if (typeof document === 'undefined') {
			return;
		}

		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target;

			if (target instanceof Element && target.closest('[data-resource-jump-trigger="true"]')) {
				return;
			}

			resourceJumpState.current = null;
		};

		document.addEventListener('pointerdown', handlePointerDown, true);
		return () => document.removeEventListener('pointerdown', handlePointerDown, true);
	}, []);

	useEffect(() => {
		resetResourceJumpState();
	}, [selectedScenarioId]);

	function handleTabChange(tab: OutputTab) {
		if (tab === activeTab) {
			return;
		}

		advanceViewContextEpoch();
		setActiveTab(tab);

		if (tab === 'simplified') {
			setSourcePreviewMode('resource');
			return;
		}

		setBundlePreviewMode('resource');
	}

	function handlePreviewModeChange(mode: PreviewMode) {
		if (mode === previewMode) {
			return;
		}

		advanceViewContextEpoch();

		if (isSourceTab) {
			setSourcePreviewMode(mode);
			return;
		}

		setBundlePreviewMode(mode);
	}

	function handleSourceResourceJump(resourceType: string) {
		if (!canJumpToResource) {
			return;
		}

		const nextOrdinal =
			resourceJumpState.current?.resourceType === resourceType ? resourceJumpState.current.ordinal + 1 : 0;

		resourceJumpState.current = {
			resourceType,
			ordinal: nextOrdinal,
		};
		resourceJumpContextRef.current = {
			...viewContext,
			epoch: viewContextEpoch,
		};
		setActiveResourceType(resourceType);
		setResourceJumpTarget((current) => ({
			resourceType,
			nonce: (current?.nonce ?? 0) + 1,
			ordinal: nextOrdinal,
		}));
	}

	function handleSourceResourceSelect(sourceKey: string) {
		const targetResource = sourcePreviewResources.find((resource) => resource.sourceKey === sourceKey);

		if (!targetResource) {
			return;
		}

		const nextEpoch = viewContextEpoch + 1;
		setViewContextEpoch(nextEpoch);
		setActiveTab('simplified');
		setSourcePreviewMode('resource');
		resourceJumpState.current = {
			resourceType: targetResource.resourceType,
			ordinal: 0,
		};
		resourceJumpContextRef.current = {
			activeTab: 'simplified',
			previewMode: 'resource',
			epoch: nextEpoch,
		};
		setActiveResourceType(targetResource.resourceType);
		setResourceJumpTarget((current) => ({
			resourceType: targetResource.resourceType,
			nonce: (current?.nonce ?? 0) + 1,
			ordinal: 0,
			sourceKey,
		}));
	}

	function handleScenarioChange(scenarioId: string) {
		setRouteState((current) => ({ ...current, scenarioId }));
		setSelectedScenarioId(scenarioId);
	}

	function handleScenarioSeedChange(seed: string) {
		setRouteState((current) => ({ ...current, seed }));
	}

	function advanceViewContextEpoch() {
		setViewContextEpoch((current) => current + 1);
	}

	function resetResourceJumpState() {
		setActiveResourceType(null);
		resourceJumpState.current = null;
		resourceJumpContextRef.current = null;
		setResourceJumpTarget(null);
	}

	function renderPreviewPanel() {
		return (
			<PreviewPanel {...previewPanelProps}>
				<ScenarioPreviewContent {...previewContentProps} />
			</PreviewPanel>
		);
	}

	return (
		<div className="min-h-full bg-[#f5f7fb] text-slate-800 antialiased xl:h-full xl:overflow-hidden">
			<main className="mx-auto flex min-h-full max-w-[1680px] flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-6 sm:py-5 lg:px-8 xl:h-full xl:min-h-0">
				{scenarioSource === 'missing' ? (
					<StatusCard
						title="No authored scenarios found"
						message="No authored scenarios are currently available from the configured data source."
					/>
				) : null}

				<section className="flex flex-1 flex-col gap-3 sm:gap-4 xl:hidden">
					<ScenarioMobileHeader {...scenarioPanelProps} />
					{renderPreviewPanel()}
					<ScenarioMobileDetails {...scenarioPanelProps} />
				</section>

				<section className="hidden min-h-0 flex-1 gap-4 xl:grid xl:grid-cols-[360px_minmax(0,1fr)]">
					<ScenarioPanel {...scenarioPanelProps} />
					{renderPreviewPanel()}
				</section>
			</main>
		</div>
	);
}
