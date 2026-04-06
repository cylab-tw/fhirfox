import type { CSSProperties } from 'react';

export const JSON_FONT_SIZE_PX = 13.5;

export const JSON_GUTTER_WIDTH_REM = 3.25;

export const JSON_INDENT = 15;

export const JSON_LINE_HEIGHT = 1.75;

export const JSON_LINE_HEIGHT_PX = JSON_FONT_SIZE_PX * JSON_LINE_HEIGHT;

export const jsonViewerTheme: CSSProperties = {
	'--w-rjv-background-color': 'transparent',
	'--w-rjv-font-family':
		'ui-monospace, SFMono-Regular, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace',
	'--w-rjv-color': '#334155',
	'--w-rjv-line-color': 'rgba(148, 163, 184, 0.22)',
	'--w-rjv-arrow-color': '#94a3b8',
	'--w-rjv-info-color': '#94a3b8',
	'--w-rjv-curlybraces-color': '#64748b',
	'--w-rjv-brackets-color': '#64748b',
	'--w-rjv-colon-color': '#94a3b8',
	'--w-rjv-key-string': '#475569',
	'--w-rjv-key-number': '#475569',
	'--w-rjv-type-string-color': '#0f766e',
	'--w-rjv-type-int-color': '#7c3aed',
	'--w-rjv-type-float-color': '#7c3aed',
	'--w-rjv-type-boolean-color': '#1d4ed8',
	'--w-rjv-type-null-color': '#64748b',
	'--w-rjv-quotes-string-color': '#0f766e',
	fontSize: `${JSON_FONT_SIZE_PX}px`,
	lineHeight: `${JSON_LINE_HEIGHT_PX}px`,
	whiteSpace: 'nowrap',
} as CSSProperties;
