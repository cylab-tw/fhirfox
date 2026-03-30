import { useEffect, useMemo, useState } from 'react';

import type {
	FhirBundleRecord,
	ScenarioLevelDefinition,
	ScenarioRecord,
	ScenarioResultRecord,
	SourceCodeDisplayMap,
	SourceFieldDocRecord,
} from '../types.js';
import type { ScenarioBrowserDataSource } from '../data-source.js';

interface ScenarioBrowserState {
	scenarioSource: 'authored' | 'missing';
	levelDefinitions: ScenarioLevelDefinition[];
	scenarios: ScenarioRecord[];
	sourceFieldDocs: Record<string, SourceFieldDocRecord>;
	sourceCodeDisplayMap: SourceCodeDisplayMap;
	selectedScenarioId: string;
	selectedScenario: ScenarioRecord | null;
	selectedScenarioResult: ScenarioResultRecord | null;
	selectedBundle: FhirBundleRecord | null;
	scenariosLoading: boolean;
	sourceFieldDocsLoading: boolean;
	scenarioLoading: boolean;
	bundleLoading: boolean;
	scenariosError: string | null;
	sourceFieldDocsError: string | null;
	scenarioError: string | null;
	bundleError: string | null;
	setSelectedScenarioId: (scenarioId: string) => void;
}

export function useScenarioBrowser(
	dataSource: ScenarioBrowserDataSource,
	preferredScenarioId?: string | null,
	loadBundle?: boolean,
): ScenarioBrowserState {
	const [scenarios, setScenarios] = useState<ScenarioRecord[]>([]);
	const [scenarioSource, setScenarioSource] = useState<'authored' | 'missing'>('missing');
	const [levelDefinitions, setLevelDefinitions] = useState<ScenarioLevelDefinition[]>([]);
	const [sourceFieldDocs, setSourceFieldDocs] = useState<Record<string, SourceFieldDocRecord>>({});
	const [sourceCodeDisplayMap, setSourceCodeDisplayMap] = useState<SourceCodeDisplayMap>({});
	const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
	const [selectedScenarioResult, setSelectedScenarioResult] = useState<ScenarioResultRecord | null>(null);
	const [selectedBundle, setSelectedBundle] = useState<FhirBundleRecord | null>(null);
	const [scenariosLoading, setScenariosLoading] = useState(true);
	const [sourceFieldDocsLoading, setSourceFieldDocsLoading] = useState(true);
	const [scenarioLoading, setScenarioLoading] = useState(false);
	const [bundleLoading, setBundleLoading] = useState(false);
	const [scenariosError, setScenariosError] = useState<string | null>(null);
	const [sourceFieldDocsError, setSourceFieldDocsError] = useState<string | null>(null);
	const [scenarioError, setScenarioError] = useState<string | null>(null);
	const [bundleError, setBundleError] = useState<string | null>(null);
	const selectedScenario = useMemo(
		() => scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? null,
		[scenarios, selectedScenarioId],
	);

	useEffect(() => {
		let cancelled = false;

		async function loadScenarioIndex() {
			setScenariosLoading(true);
			setScenariosError(null);

			try {
				const index = await dataSource.loadScenarioIndex();

				if (cancelled) {
					return;
				}

				setScenarios(index.scenarios);
				setScenarioSource(index.scenarioSource);
				setLevelDefinitions(index.levelDefinitions);
				setSelectedScenarioId(resolveScenarioId(index.scenarios, preferredScenarioId));
				setScenariosLoading(false);
			} catch (loadError) {
				if (!cancelled) {
					setScenariosError(asMessage(loadError, 'Failed to load scenarios.'));
					setScenariosLoading(false);
				}
			}
		}

		void loadScenarioIndex();

		return () => {
			cancelled = true;
		};
	}, [dataSource]);

	useEffect(() => {
		let cancelled = false;

		async function loadCodeDisplayMap() {
			try {
				const displayMap = await dataSource.loadSourceCodeDisplayMap();

				if (cancelled) {
					return;
				}

				setSourceCodeDisplayMap(displayMap);
			} catch {
				if (!cancelled) {
					setSourceCodeDisplayMap({});
				}
			}
		}

		void loadCodeDisplayMap();

		return () => {
			cancelled = true;
		};
	}, [dataSource]);

	useEffect(() => {
		let cancelled = false;

		async function loadDocs() {
			setSourceFieldDocsLoading(true);
			setSourceFieldDocsError(null);

			try {
				const docs = await dataSource.loadSourceFieldDocs();

				if (cancelled) {
					return;
				}

				setSourceFieldDocs(docs);
				setSourceFieldDocsLoading(false);
			} catch (loadError) {
				if (!cancelled) {
					setSourceFieldDocsError(asMessage(loadError, 'Failed to load source field docs.'));
					setSourceFieldDocsLoading(false);
				}
			}
		}

		void loadDocs();

		return () => {
			cancelled = true;
		};
	}, [dataSource]);

	useEffect(() => {
		if (scenarios.length === 0) {
			return;
		}

		const nextScenarioId = resolveScenarioId(scenarios, preferredScenarioId);

		if (nextScenarioId && nextScenarioId !== selectedScenarioId) {
			setSelectedScenarioId(nextScenarioId);
		}
	}, [preferredScenarioId, scenarios, selectedScenarioId]);

	useEffect(() => {
		if (!selectedScenarioId) {
			setSelectedScenarioResult(null);
			setSelectedBundle(null);
			return;
		}

		let cancelled = false;
		setScenarioLoading(true);
		setScenarioError(null);

		async function loadScenarioResult() {
			try {
				const scenarioResult = await dataSource.loadScenario(selectedScenarioId);

				if (cancelled) {
					return;
				}

				setSelectedScenarioResult(scenarioResult);
				setScenarioLoading(false);
			} catch (loadError) {
				if (!cancelled) {
					setSelectedScenarioResult(null);
					setScenarioError(asMessage(loadError, 'Failed to resolve the selected scenario.'));
					setScenarioLoading(false);
				}
			}
		}

		setSelectedBundle(null);
		setBundleError(null);
		setBundleLoading(false);
		void loadScenarioResult();

		return () => {
			cancelled = true;
		};
	}, [dataSource, selectedScenarioId]);

	useEffect(() => {
		if (!selectedScenarioId || !loadBundle) {
			return;
		}

		let cancelled = false;
		setBundleLoading(true);
		setBundleError(null);

		async function loadBundleResult() {
			try {
				const bundle = await dataSource.loadFhirBundle(selectedScenarioId);

				if (cancelled) {
					return;
				}

				setSelectedBundle(bundle);
				setBundleLoading(false);
			} catch (loadError) {
				if (!cancelled) {
					setSelectedBundle(null);
					setBundleError(asMessage(loadError, 'Failed to load the FHIR bundle.'));
					setBundleLoading(false);
				}
			}
		}

		void loadBundleResult();

		return () => {
			cancelled = true;
		};
	}, [dataSource, selectedScenarioId, loadBundle]);

	return {
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
		sourceFieldDocsLoading,
		scenarioLoading,
		bundleLoading,
		scenariosError,
		sourceFieldDocsError,
		scenarioError,
		bundleError,
		setSelectedScenarioId,
	};
}

function resolveScenarioId(scenarios: ScenarioRecord[], preferredScenarioId?: string | null): string {
	if (preferredScenarioId && scenarios.some((scenario) => scenario.id === preferredScenarioId)) {
		return preferredScenarioId;
	}

	return scenarios[0]?.id ?? '';
}

function asMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}
