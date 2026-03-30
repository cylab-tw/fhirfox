interface StatusCardProps {
	title: string;
	message: string;
	tone?: 'default' | 'error';
}

export function StatusCard({ title, message, tone = 'default' }: StatusCardProps) {
	return (
		<div
			className={[
				'rounded-[24px] border px-5 py-4',
				tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-slate-200 bg-white text-slate-700',
			].join(' ')}
		>
			<h3 className="text-sm font-semibold">{title}</h3>
			<p className="mt-1 text-sm leading-6">{message}</p>
		</div>
	);
}
