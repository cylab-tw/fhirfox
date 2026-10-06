import { useState } from 'react';

import PlugathonApp from './PlugathonApp.js';
import ScenarioBrowserApp from './ScenarioBrowserApp.js';
import { I18nProvider, useI18n } from './i18n.js';

type TopLevelTab = 'pre-connectathon' | 'connectathon' | 'plugathon';

export function App() {
	return (
		<I18nProvider>
			<AppContent />
		</I18nProvider>
	);
}

function AppContent() {
	const [activeTab, setActiveTab] = useState<TopLevelTab>('pre-connectathon');
	const { locale, setLocale, t } = useI18n();

	return (
		<div className="flex min-h-dvh flex-col bg-[#f5f7fb] text-slate-800 antialiased xl:h-screen xl:min-h-0">
			<header className="shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur">
				<div className="mx-auto flex max-w-[1680px] items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8">
					<div className="flex items-center gap-2">
						<button
							type="button"
							aria-pressed={activeTab === 'pre-connectathon'}
							className={[
								'rounded-lg border px-3 py-1.5 text-xs font-semibold tracking-[0.01em] transition focus-visible:ring-4 focus-visible:ring-sky-100 focus-visible:outline-none',
								activeTab === 'pre-connectathon'
									? 'border-slate-200 bg-slate-200 text-slate-950'
									: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-950',
							].join(' ')}
							onClick={() => setActiveTab('pre-connectathon')}
						>
							Pre-Connectathon
						</button>
						<button
							type="button"
							aria-pressed={activeTab === 'connectathon'}
							className={[
								'rounded-lg border px-3 py-1.5 text-xs font-semibold tracking-[0.01em] transition focus-visible:ring-4 focus-visible:ring-sky-100 focus-visible:outline-none',
								activeTab === 'connectathon'
									? 'border-slate-200 bg-slate-200 text-slate-950'
									: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-950',
							].join(' ')}
							onClick={() => setActiveTab('connectathon')}
						>
							Connectathon
						</button>
						<button
							type="button"
							aria-pressed={activeTab === 'plugathon'}
							className={[
								'rounded-lg border px-3 py-1.5 text-xs font-semibold tracking-[0.01em] transition focus-visible:ring-4 focus-visible:ring-sky-100 focus-visible:outline-none',
								activeTab === 'plugathon'
									? 'border-slate-200 bg-slate-200 text-slate-950'
									: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-950',
							].join(' ')}
							onClick={() => setActiveTab('plugathon')}
						>
							Plugathon
						</button>
					</div>
					<div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5" aria-label={t('language')}>
						{(['zh-TW', 'en'] as const).map((value) => (
							<button
								key={value}
								type="button"
								aria-pressed={locale === value}
								className={[
									'rounded-md px-2.5 py-1 text-xs font-semibold transition',
									locale === value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900',
								].join(' ')}
								onClick={() => setLocale(value)}
							>
								{value === 'zh-TW' ? t('traditionalChinese') : t('english')}
							</button>
						))}
					</div>
				</div>
			</header>
			<main className="min-h-0 flex-1">
				{activeTab === 'pre-connectathon' && <ScenarioBrowserApp />}
				{activeTab === 'connectathon' && (
					<div className="flex h-full items-center justify-center px-6">
						<p className="text-[18px] font-medium tracking-tight text-slate-500">{t('comingSoon')}</p>
					</div>
				)}
				{activeTab === 'plugathon' && <PlugathonApp />}
			</main>
		</div>
	);
}
