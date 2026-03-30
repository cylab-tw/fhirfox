import { JsonViewer } from './JsonViewer.js';
import { ResourcePreview } from './ResourcePreview.js';
import { StatusCard } from './StatusCard.js';

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
	const activePreviewError = scenariosError ?? (isSourceTab ? scenarioError : bundleError) ?? null;

	if (scenariosLoading) {
		return renderStatusCard('Loading', 'Loading available scenarios.');
	}

	if (scenariosError) {
		return renderStatusCard('Error', scenariosError, 'error');
	}

	if (isSourceTab && scenarioLoading) {
		return renderStatusCard('Loading', 'Loading source resources for this scenario.');
	}

	if (!isSourceTab && bundleLoading) {
		return renderStatusCard('Loading', 'Loading the FHIR bundle for this scenario.');
	}

	if (activePreviewError) {
		return renderStatusCard('Error', activePreviewError, 'error');
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
			renderStatusCard('No resources', emptyPreviewMessage)
		);
	}

	return previewOutput ? (
		<div className="h-full px-6 py-5">
			<JsonViewer
				value={previewOutput as Record<string, unknown>}
				sourceFieldDocs={sourceFieldDocs}
				sourceCodeDisplayMap={sourceCodeDisplayMap}
				docsEnabled={previewDocsEnabled}
				showCodeDisplayValues={isSourceTab}
				className="h-full"
			/>
		</div>
	) : (
		renderStatusCard('No output', emptyPreviewMessage)
	);
}

function renderStatusCard(title: string, message: string, tone?: 'default' | 'error') {
	return (
		<div className="px-6 py-5">
			<StatusCard title={title} message={message} tone={tone} />
		</div>
	);
}
