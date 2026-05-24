import type { FhirResource } from './types.js';

export function applyResourceDefaults(resource: FhirResource): void {
	applyNarrativeDefault(resource);
}

function applyNarrativeDefault(resource: FhirResource): void {
	if (typeof resource.text === 'object' && resource.text !== null) {
		return;
	}

	const label = resource.resourceType;
	resource.text = {
		status: 'generated',
		div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${escapeHtml(label)}</p></div>`,
	};
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}
