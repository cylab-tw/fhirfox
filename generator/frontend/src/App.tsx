import { useState } from 'react';

import ScenarioBrowserApp from './ScenarioBrowserApp.js';

type TopLevelTab = 'pre-connectathon' | 'connectathon';

export function App() {
	const [activeTab, setActiveTab] = useState<TopLevelTab>('pre-connectathon');

	return (
		<div className="flex h-screen min-h-0 flex-col bg-[#f5f7fb] text-slate-800 antialiased">
			<header className="shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur">
				<div className="mx-auto flex max-w-[1680px] items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8">
					<div className="flex items-center gap-2">
						<button
							type="button"
							aria-pressed={activeTab === 'pre-connectathon'}
							className={[
								'rounded-lg border px-3 py-1.5 text-xs font-semibold tracking-[0.01em] transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100',
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
								'rounded-lg border px-3 py-1.5 text-xs font-semibold tracking-[0.01em] transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100',
								activeTab === 'connectathon'
									? 'border-slate-200 bg-slate-200 text-slate-950'
									: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-950',
							].join(' ')}
							onClick={() => setActiveTab('connectathon')}
						>
							Connectathon
						</button>
					</div>
				</div>
			</header>
			<main className="min-h-0 flex-1">
				{activeTab === 'pre-connectathon' ? (
					<ScenarioBrowserApp />
				) : (
					<div className="flex h-full items-center justify-center px-6">
						<p className="text-[18px] font-medium tracking-tight text-slate-500">尚未開放</p>
					</div>
				)}
			</main>
		</div>
	);
}
