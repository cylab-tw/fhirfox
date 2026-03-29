import type { FhirCodingMapping, FhirResource } from '../types.js';

/**
 * Writes one converted value into a limited subset of FHIR-style element paths.
 */
export function writeFhirValue(
	resource: FhirResource,
	fhirPath: string,
	value: unknown,
	dataType: string,
	mapping?: FhirCodingMapping,
): void {
	const parsedPath = parseFhirPath(fhirPath);
	let current: Record<string, unknown> = resource;

	for (const [index, segment] of parsedPath.segments.entries()) {
		const isLeaf = index === parsedPath.segments.length - 1;
		const previousSegment = index > 0 ? parsedPath.segments[index - 1] : undefined;

		if (segment.index === undefined) {
			if (isLeaf) {
				current[segment.name] = coerceValue(value, dataType);

				if (mapping && segment.name === 'code') {
					if (previousSegment?.name.endsWith('Quantity')) {
						current.unit = mapping.display;
					} else {
						current.display = mapping.display;
					}
					current.system = mapping.system;
				}

				return;
			}

			current[segment.name] = ensureObject(current[segment.name], segment, current);
			current = current[segment.name] as Record<string, unknown>;
			continue;
		}

		const array = ensureArray(current[segment.name], segment, current);
		if (isLeaf) {
			array[segment.index] = coerceValue(value, dataType);
			return;
		}

		const entry = ensureIndexedObject(array, segment.index);

		if (segment.sliceName) {
			entry.use ??= segment.sliceName;
		}

		current = entry;
	}
}

interface ParsedSegment {
	raw: string;
	name: string;
	index?: number;
	sliceName?: string;
}

function parseFhirPath(fhirPath: string): { resourceType: string; segments: ParsedSegment[] } {
	const segments = fhirPath.split('.');
	const resourceType = segments.shift();

	if (!resourceType || segments.length === 0) {
		throw new Error(`Unsupported FHIR path "${fhirPath}".`);
	}

	return {
		resourceType,
		segments: segments.map(parseSegment),
	};
}

function parseSegment(segment: string): ParsedSegment {
	const match = /^(?<name>[A-Za-z][A-Za-z0-9]*)(?:\[(?<index>\d+)\])?(?::(?<sliceName>[A-Za-z][A-Za-z0-9-]*))?$/u.exec(
		segment,
	);

	if (!match?.groups) {
		throw new Error(`Unsupported FHIR path segment "${segment}".`);
	}

	return {
		raw: segment,
		name: match.groups.name,
		index: match.groups.index === undefined ? undefined : Number.parseInt(match.groups.index, 10),
		sliceName: match.groups.sliceName,
	};
}

function ensureObject(
	value: unknown,
	segment: ParsedSegment,
	parent: Record<string, unknown>,
): Record<string, unknown> {
	if (value === undefined) {
		const created: Record<string, unknown> = {};
		parent[segment.name] = created;
		return created;
	}

	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error(`FHIR path segment "${segment.raw}" expected an object container.`);
	}

	return value as Record<string, unknown>;
}

function ensureArray(value: unknown, segment: ParsedSegment, parent: Record<string, unknown>): unknown[] {
	if (value === undefined) {
		const created: unknown[] = [];
		parent[segment.name] = created;
		return created;
	}

	if (!Array.isArray(value)) {
		throw new Error(`FHIR path segment "${segment.raw}" expected an array container.`);
	}

	return value;
}

function ensureIndexedObject(array: unknown[], index: number): Record<string, unknown> {
	array[index] ??= {};
	const value = array[index];

	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error(`FHIR path array entry at index ${index} must be an object.`);
	}

	return value as Record<string, unknown>;
}

function coerceValue(value: unknown, dataType: string): unknown {
	if (dataType === 'boolean') {
		if (typeof value === 'boolean') {
			return value;
		}

		if (value === 'true') {
			return true;
		}

		if (value === 'false') {
			return false;
		}

		throw new Error(`Cannot coerce "${String(value)}" to boolean.`);
	}

	return value;
}
