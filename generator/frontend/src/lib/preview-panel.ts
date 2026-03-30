import type { OutputTab, PreviewMode } from '../types.js';

export function getPreviewHelperText(activeTab: OutputTab, previewMode: PreviewMode): string | undefined {
	if (activeTab === 'simplified' && previewMode === 'document') {
		return '可 hover 欄位查看說明。';
	}

	if (activeTab === 'simplified' && previewMode === 'resource') {
		return '逐筆檢視來源資料。';
	}

	if (activeTab === 'fhir' && previewMode === 'resource') {
		return '逐筆檢視 FHIR 輸出。';
	}

	if (activeTab === 'fhir' && previewMode === 'document') {
		return '查看完整 FHIR Bundle JSON。';
	}

	return undefined;
}

export function getEmptyPreviewMessage(activeTab: OutputTab, previewMode: PreviewMode): string {
	if (previewMode === 'document') {
		return 'Select a scenario to inspect its source JSON or converted FHIR bundle.';
	}

	return activeTab === 'simplified'
		? 'This scenario did not produce any source resources to inspect.'
		: 'This scenario did not produce any bundle resources to inspect.';
}
