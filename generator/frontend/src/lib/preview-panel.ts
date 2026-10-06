import type { OutputTab, PreviewMode } from '../types.js';
import type { Locale } from '../i18n.js';

export function getPreviewHelperText(
	activeTab: OutputTab,
	previewMode: PreviewMode,
	locale: Locale,
): string | undefined {
	if (activeTab === 'simplified' && previewMode === 'document') {
		return locale === 'en' ? 'Hover over a field to view its description.' : '可 hover 欄位查看說明。';
	}

	if (activeTab === 'simplified' && previewMode === 'resource') {
		return locale === 'en' ? 'Inspect source resources individually.' : '逐筆檢視來源資料。';
	}

	if (activeTab === 'fhir' && previewMode === 'resource') {
		return locale === 'en' ? 'Inspect FHIR output resources individually.' : '逐筆檢視 FHIR 輸出。';
	}

	if (activeTab === 'fhir' && previewMode === 'document') {
		return locale === 'en' ? 'View the complete FHIR Bundle JSON.' : '查看完整 FHIR Bundle JSON。';
	}

	return undefined;
}

export function getEmptyPreviewMessage(activeTab: OutputTab, previewMode: PreviewMode, locale: Locale): string {
	if (previewMode === 'document') {
		return locale === 'en'
			? 'Select a scenario to inspect its source JSON or converted FHIR bundle.'
			: '請選擇情境以查看來源 JSON 或轉換後的 FHIR Bundle。';
	}

	if (locale === 'en') {
		return activeTab === 'simplified'
			? 'This scenario did not produce any source resources to inspect.'
			: 'This scenario did not produce any bundle resources to inspect.';
	}

	return activeTab === 'simplified' ? '此情境沒有可檢視的來源資源。' : '此情境沒有可檢視的 Bundle 資源。';
}
