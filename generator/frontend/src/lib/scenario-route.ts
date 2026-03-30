const redirectStorageKey = 'fhirfox.redirect-path';
const scenarioPathSegment = '/scenarios/';

export interface ScenarioRouteState {
	basePath: string;
	scenarioId: string | null;
}

export function getScenarioRouteState(pathname: string): ScenarioRouteState {
	const normalizedPath = normalizePathname(pathname);
	const markerIndex = normalizedPath.lastIndexOf(scenarioPathSegment);

	if (markerIndex >= 0) {
		const basePath = normalizeBasePath(normalizedPath.slice(0, markerIndex));
		const scenarioId = decodeURIComponent(normalizedPath.slice(markerIndex + scenarioPathSegment.length)) || null;
		return { basePath, scenarioId };
	}

	return {
		basePath: normalizedPath === '/' ? '' : normalizedPath,
		scenarioId: null,
	};
}

export function buildScenarioPath(basePath: string, scenarioId: string): string {
	return `${normalizeBasePath(basePath)}/scenarios/${encodeURIComponent(scenarioId)}`.replace(/^\/\//u, '/');
}

export function restoreRedirectedScenarioPath(): boolean {
	if (typeof window === 'undefined') {
		return false;
	}

	const redirectedPath = window.sessionStorage.getItem(redirectStorageKey);

	if (!redirectedPath) {
		return false;
	}

	window.sessionStorage.removeItem(redirectStorageKey);
	window.history.replaceState(null, '', redirectedPath);
	return true;
}

export function getStoredRedirectPathKey(): string {
	return redirectStorageKey;
}

function normalizeBasePath(pathname: string): string {
	const normalized = normalizePathname(pathname);
	return normalized === '/' ? '' : normalized;
}

function normalizePathname(pathname: string): string {
	if (!pathname || pathname === '/') {
		return '/';
	}

	const withoutFallbackPage = pathname.replace(/\/404\.html(?=\/|$)/u, '');
	return withoutFallbackPage.replace(/\/+$/u, '') || '/';
}
