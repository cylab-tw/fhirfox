import { readSourceResourceType } from '@fhirfox/converter/browser';
import { singularizeSourceResourceType } from './source-resource-display.js';

import type { SourceFieldDocRecord } from '../types.js';

export function getFieldPath(keys: Array<string | number> | undefined, key: string, pathPrefix?: string): string {
	const normalizedSegments = (keys ?? [])
		.filter((segment): segment is string => typeof segment === 'string' && segment.length > 0)
		.filter((segment) => segment !== 'root');

	if (normalizedSegments.at(-1) !== key) {
		normalizedSegments.push(key);
	}

	if (normalizedSegments.length > 0) {
		normalizedSegments[0] = singularizeSourceResourceType(normalizedSegments[0]);
	}

	const path = normalizedSegments.join('.');

	if (!pathPrefix) {
		return path;
	}

	if (path === pathPrefix || path.startsWith(`${pathPrefix}.`)) {
		return path;
	}

	return path.length > 0 ? `${pathPrefix}.${path}` : pathPrefix;
}

export function getSourceFieldDoc(
	docs: Record<string, SourceFieldDocRecord>,
	path: string,
	key: string,
): SourceFieldDocRecord | null {
	return docs[path] ?? docs[key] ?? null;
}

export function getSourceFieldPathPrefix(value: unknown): string | undefined {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return undefined;
	}

	const resourceType = (() => {
		try {
			return readSourceResourceType(value as { id?: string; __resourceType?: string; resourceType?: string });
		} catch {
			return undefined;
		}
	})();

	if (!resourceType || resourceType === 'Bundle') {
		return undefined;
	}

	return resourceType.toLowerCase();
}
