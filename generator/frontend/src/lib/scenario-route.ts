const redirectStorageKey = 'fhirfox.redirect-path';
const scenarioPathSegment = '/scenarios/';

export interface ScenarioRouteState {
	basePath: string;
	scenarioId: string | null;
	seed: string | null;
}

export function getScenarioRouteState(pathname: string, search = '', defaultSeed?: string | null): ScenarioRouteState {
	const normalizedPath = normalizePathname(pathname);
	const markerIndex = normalizedPath.lastIndexOf(scenarioPathSegment);
	const seed = readScenarioSeed(search, defaultSeed);

	if (markerIndex >= 0) {
		const basePath = normalizeBasePath(normalizedPath.slice(0, markerIndex));
		const scenarioId = decodeURIComponent(normalizedPath.slice(markerIndex + scenarioPathSegment.length)) || null;
		return { basePath, scenarioId, seed };
	}

	return {
		basePath: normalizedPath === '/' ? '' : normalizedPath,
		scenarioId: null,
		seed,
	};
}

export function buildScenarioPath(basePath: string, scenarioId: string, seed?: string | null): string {
	const query = normalizeScenarioSeed(seed);
	return `${normalizeBasePath(basePath)}/scenarios/${encodeURIComponent(scenarioId)}${query}`.replace(/^\/\//u, '/');
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

function readScenarioSeed(search: string, defaultSeed?: string | null): string | null {
	const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
	const seed = params.get('seed');

	if (seed && seed.length > 0) {
		return seed;
	}

	return defaultSeed ?? null;
}

function normalizeScenarioSeed(seed?: string | null): string {
	if (!seed) {
		return '';
	}

	return `?seed=${encodeURIComponent(seed)}`;
}
