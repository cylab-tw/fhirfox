import { useMemo } from 'react';

import { JsonViewer } from './json-viewer/JsonViewer.js';
import { ResourcePreview } from './ResourcePreview.js';
import { StatusCard } from './StatusCard.js';
import { createScenarioBrowserJsonViewerExtensionsForValue } from '../helpers/scenario-browser/json-viewer-adapter.js';
import { useI18n } from '../i18n.js';

import type {
	PreviewResourceItem,
	ResourceJumpScrollBehavior,
	ResourceJumpTarget,
	SourceCodeDisplayMap,
	SourceFieldDocRecord,
} from '../types.js';

interface ScenarioPreviewContentProps {
	isSourceTab: boolean;
	isResourceMode: boolean;
	scenariosLoading: boolean;
	scenarioLoading: boolean;
	bundleLoading: boolean;
	scenariosError: string | null;
	scenarioError: string | null;
	bundleError: string | null;
	previewResources: PreviewResourceItem[];
	previewOutput: unknown;
	sourceFieldDocs: Record<string, SourceFieldDocRecord>;
	sourceCodeDisplayMap: SourceCodeDisplayMap;
	previewDocsEnabled: boolean;
	resourceJumpTarget: ResourceJumpTarget | null;
	resourceJumpScrollBehavior?: ResourceJumpScrollBehavior;
	onSourceResourceSelect?: (sourceKey: string) => void;
	onExpandedResourceTypeChange?: (resourceType: string | null) => void;
	emptyPreviewMessage: string;
}

export function ScenarioPreviewContent({
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
	onSourceResourceSelect,
	onExpandedResourceTypeChange,
	emptyPreviewMessage,
}: ScenarioPreviewContentProps) {
	const { locale, t } = useI18n();
	const activePreviewError = scenariosError ?? (isSourceTab ? scenarioError : bundleError) ?? null;
	const previewOutputExtensions = useMemo(
		() =>
			createScenarioBrowserJsonViewerExtensionsForValue({
				value: previewOutput,
				sourceFieldDocs,
				sourceCodeDisplayMap,
				docsEnabled: previewDocsEnabled,
				showCodeDisplayValues: isSourceTab,
				locale,
			}),
		[isSourceTab, locale, previewDocsEnabled, previewOutput, sourceCodeDisplayMap, sourceFieldDocs],
	);

	if (scenariosLoading) {
		return renderStatusCard(t('loading'), t('loadingScenarios'));
	}

	if (scenariosError) {
		return renderStatusCard(t('error'), scenariosError, 'error');
	}

	if (isSourceTab && scenarioLoading) {
		return renderStatusCard(t('loading'), t('loadingSource'));
	}

	if (!isSourceTab && bundleLoading) {
		return renderStatusCard(t('loading'), t('loadingFhir'));
	}

	if (activePreviewError) {
		return renderStatusCard(t('error'), activePreviewError, 'error');
	}

	if (isResourceMode) {
		return previewResources.length > 0 ? (
			<ResourcePreview
				resources={previewResources}
				sourceFieldDocs={sourceFieldDocs}
				sourceCodeDisplayMap={sourceCodeDisplayMap}
				docsEnabled={previewDocsEnabled}
				showCodeDisplayValues={isSourceTab}
				onSourceResourceSelect={isSourceTab ? onSourceResourceSelect : undefined}
				scrollToResourceType={resourceJumpTarget}
				scrollBehavior={resourceJumpScrollBehavior}
				onExpandedResourceTypeChange={onExpandedResourceTypeChange}
			/>
		) : (
			renderStatusCard(t('noResources'), emptyPreviewMessage)
		);
	}

	return previewOutput ? (
		<div className="h-[72dvh] min-h-[420px] px-4 py-4 sm:px-6 sm:py-5 xl:h-full xl:min-h-0">
			<JsonViewer
				value={isJsonObject(previewOutput) ? previewOutput : undefined}
				extensions={previewOutputExtensions}
				className="h-full"
			/>
		</div>
	) : (
		renderStatusCard(t('noOutput'), emptyPreviewMessage)
	);
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function renderStatusCard(title: string, message: string, tone?: 'default' | 'error') {
	return (
		<div className="px-4 py-4 sm:px-6 sm:py-5">
			<StatusCard title={title} message={message} tone={tone} />
		</div>
	);
}
