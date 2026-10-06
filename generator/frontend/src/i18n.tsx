import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import type { PropsWithChildren } from 'react';

export type Locale = 'zh-TW' | 'en';

const messages = {
	'zh-TW': {
		language: '語言',
		traditionalChinese: '繁中',
		english: 'English',
		comingSoon: '尚未開放',
		sourceData: '來源資料',
		fhirOutput: 'FHIR 輸出',
		resourceView: '資源檢視',
		fullJson: '完整 JSON',
		dataView: '資料檢視',
		selectScenario: '選擇情境',
		otherLevel: '其他 Level',
		caseInfo: '案例資訊',
		caseSummary: '案例摘要',
		coveredData: '涵蓋資料',
		warnings: '注意事項',
		scenarioDetails: '情境說明',
		noScenario: '目前沒有可載入的情境定義。請將情境檔放到 `dataset/scenarios/`，前端就會在 dev/build 時自動讀取。',
		seedHint: '變更 seed 會重新解析目前情境。',
		noSummary: '目前沒有額外的情境摘要。',
		levelInfo: '查看測試情境分級說明',
		levelDefinitions: '測試情境分級說明',
		close: '關閉',
		resourceCount: '共 {types} 類資源，合計 {total} 筆。',
		scenarioNotResolved: '情境尚未完成解析。',
		copied: '已複製',
		copy: '複製',
		required: '必填',
		yes: '是',
		no: '否',
		viewResource: '查看 {resource}',
		hoverHelp: '可 hover 欄位查看說明。',
		viewSourceItems: '逐筆檢視來源資料。',
		viewFhirItems: '逐筆檢視 FHIR 輸出。',
		viewBundle: '查看完整 FHIR Bundle JSON。',
		loading: '載入中',
		loadingScenarios: '正在載入可用情境。',
		loadingSource: '正在載入此情境的來源資料。',
		loadingFhir: '正在載入此情境的 FHIR Bundle。',
		error: '錯誤',
		noResources: '沒有資源',
		noOutput: '沒有輸出',
		noAuthoredScenarios: '找不到已建立的情境',
		noAuthoredScenariosMessage: '目前設定的資料來源沒有可用的情境。',
		sourceResources: '{count} 筆來源資源',
		fhirEntries: '{count} 筆 FHIR entries',
		seedMeta: 'seed {seed}',
		warningCount: '{count} 個警告',
	},
	en: {
		language: 'Language',
		traditionalChinese: '繁中',
		english: 'English',
		comingSoon: 'Coming soon',
		sourceData: 'Source Data',
		fhirOutput: 'FHIR Output',
		resourceView: 'Resource View',
		fullJson: 'Full JSON',
		dataView: 'Data Viewer',
		selectScenario: 'Select Scenario',
		otherLevel: 'Other Levels',
		caseInfo: 'Case Information',
		caseSummary: 'Case Summary',
		coveredData: 'Included Data',
		warnings: 'Warnings',
		scenarioDetails: 'Scenario Details',
		noScenario:
			'No scenario definition is available. Add scenario files to `dataset/scenarios/` for dev/build loading.',
		seedHint: 'Changing the seed resolves the current scenario again.',
		noSummary: 'No additional scenario summary is available.',
		levelInfo: 'View scenario level definitions',
		levelDefinitions: 'Scenario Level Definitions',
		close: 'Close',
		resourceCount: '{types} resource types, {total} resources in total.',
		scenarioNotResolved: 'The scenario has not been resolved yet.',
		copied: 'Copied',
		copy: 'Copy',
		required: 'Required',
		yes: 'Yes',
		no: 'No',
		viewResource: 'View {resource}',
		hoverHelp: 'Hover over a field to view its description.',
		viewSourceItems: 'Inspect source resources individually.',
		viewFhirItems: 'Inspect FHIR output resources individually.',
		viewBundle: 'View the complete FHIR Bundle JSON.',
		loading: 'Loading',
		loadingScenarios: 'Loading available scenarios.',
		loadingSource: 'Loading source resources for this scenario.',
		loadingFhir: 'Loading the FHIR Bundle for this scenario.',
		error: 'Error',
		noResources: 'No resources',
		noOutput: 'No output',
		noAuthoredScenarios: 'No authored scenarios found',
		noAuthoredScenariosMessage: 'No authored scenarios are currently available from the configured data source.',
		sourceResources: '{count} source resources',
		fhirEntries: '{count} FHIR entries',
		seedMeta: 'seed {seed}',
		warningCount: '{count} warnings',
	},
} as const;

export type MessageKey = keyof (typeof messages)['zh-TW'];
type Variables = Record<string, string | number>;

interface I18nValue {
	locale: Locale;
	setLocale: (locale: Locale) => void;
	t: (key: MessageKey, variables?: Variables) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: PropsWithChildren) {
	const [locale, setLocale] = useState<Locale>(() => {
		if (typeof window === 'undefined') return 'zh-TW';
		return window.localStorage.getItem('fhirfox-locale') === 'en' ? 'en' : 'zh-TW';
	});

	useEffect(() => {
		document.documentElement.lang = locale;
		window.localStorage.setItem('fhirfox-locale', locale);
	}, [locale]);

	const value = useMemo<I18nValue>(
		() => ({
			locale,
			setLocale,
			t: (key, variables = {}) =>
				Object.entries(variables).reduce(
					(text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)),
					messages[locale][key] as string,
				),
		}),
		[locale],
	);

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
	const value = useContext(I18nContext);
	if (!value) throw new Error('useI18n must be used within I18nProvider.');
	return value;
}
