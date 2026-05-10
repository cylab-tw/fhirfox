import type { DatasetProvider, Resource } from '../../dataset/src/index.ts';
import type { IndexedResource, ResourceLink } from './types.js';

export function createInMemoryProvider(resources: IndexedResource[], links: ResourceLink[]): DatasetProvider {
	return {
		async queryResources(resourceType: string, filter?: Record<string, unknown>) {
			return resources.filter((resource) => {
				if (resource.type !== resourceType) {
					return false;
				}

				if (!filter) {
					return true;
				}

				return matchesFilter(resource, filter, resources);
			});
		},
		listResourceLinks() {
			return links;
		},
		async queryLinkedResources(resourceType: string, field: string, targetId: string) {
			return resources.filter((resource) => {
				if (resource.type !== resourceType) {
					return false;
				}

				const value = resource[field];

				if (typeof value === 'string') {
					return value === targetId;
				}

				if (Array.isArray(value)) {
					return value.some((entry) => entry === targetId);
				}

				return false;
			});
		},
	};
}

function matchesFilter(resource: Resource, filter: Record<string, unknown>, resources: Resource[]): boolean {
	return Object.entries(filter).every(([key, expected]) => {
		if (key === 'age') {
			return matchesAge(resource, expected);
		}

		if (key === 'stayDays') {
			return matchesStayDays(resource, expected);
		}

		if (key === 'samePerson') {
			return matchesSamePerson(resource, filter, resources, expected);
		}

		if (key === 'samePersonEncounter' || key === 'samePersonEncounterCount') {
			return true;
		}

		return matchesValue(resource[key], expected);
	});
}

function matchesValue(actual: unknown, expected: unknown): boolean {
	if (isComparison(expected) && typeof actual !== 'object') {
		const comparable = toComparable(actual);

		if (comparable === undefined) {
			return false;
		}

		return compareRange(comparable, expected);
	}

	return actual === expected;
}

function matchesAge(resource: Resource, expected: unknown): boolean {
	const birthday = resource.birthday;

	if (typeof birthday !== 'string') {
		return false;
	}

	const age = calculateAgeYears(birthday);

	if (age === undefined) {
		return false;
	}

	return isComparison(expected) ? compareRange(age, expected) : age === expected;
}

function matchesStayDays(resource: Resource, expected: unknown): boolean {
	const periodStart = resource.periodStart;
	const periodEnd = resource.periodEnd;

	if (typeof periodStart !== 'string' || typeof periodEnd !== 'string') {
		return false;
	}

	const start = new Date(periodStart);
	const end = new Date(periodEnd);

	if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
		return false;
	}

	const stayDays = (end.valueOf() - start.valueOf()) / (1000 * 60 * 60 * 24);
	return isComparison(expected) ? compareRange(stayDays, expected) : stayDays === expected;
}

function matchesSamePerson(
	resource: Resource,
	filter: Record<string, unknown>,
	resources: Resource[],
	expected: unknown,
): boolean {
	if (expected !== true) {
		return true;
	}

	const patientId = typeof resource.patientId === 'string' ? resource.patientId : resource.id;
	const linkedEncounterFilter =
		typeof filter.samePersonEncounter === 'object' && filter.samePersonEncounter !== null
			? (filter.samePersonEncounter as Record<string, unknown>)
			: undefined;
	const encounterCountFilter =
		typeof filter.samePersonEncounterCount === 'object' && filter.samePersonEncounterCount !== null
			? (filter.samePersonEncounterCount as Record<string, unknown>)
			: undefined;

	if (!linkedEncounterFilter) {
		return true;
	}

	const matchingEncounters = resources.filter(
		(entry) =>
			entry.type === 'encounter' &&
			entry.patientId === patientId &&
			matchesFilter(entry, linkedEncounterFilter, resources),
	);

	if (!encounterCountFilter) {
		return matchingEncounters.length > 0;
	}

	return compareRange(matchingEncounters.length, encounterCountFilter);
}

function isComparison(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toComparable(value: unknown): number | string | undefined {
	if (typeof value === 'number' || typeof value === 'string') {
		return value;
	}

	return undefined;
}

function compareRange(actual: number | string, expected: Record<string, unknown>): boolean {
	if ('gte' in expected && !compareGreaterThanOrEqual(actual, expected.gte)) {
		return false;
	}

	if ('lte' in expected && !compareLessThanOrEqual(actual, expected.lte)) {
		return false;
	}

	if ('gt' in expected && !compareGreaterThan(actual, expected.gt)) {
		return false;
	}

	if ('lt' in expected && !compareLessThan(actual, expected.lt)) {
		return false;
	}

	if ('$gte' in expected && !compareGreaterThanOrEqual(actual, expected.$gte)) {
		return false;
	}

	if ('$lte' in expected && !compareLessThanOrEqual(actual, expected.$lte)) {
		return false;
	}

	if ('$gt' in expected && !compareGreaterThan(actual, expected.$gt)) {
		return false;
	}

	if ('$lt' in expected && !compareLessThan(actual, expected.$lt)) {
		return false;
	}

	return true;
}

function compareGreaterThanOrEqual(actual: number | string, expected: unknown): boolean {
	if (typeof actual === 'number' && typeof expected === 'number') {
		return actual >= expected;
	}

	if (typeof actual === 'string' && typeof expected === 'string') {
		return actual >= expected;
	}

	return false;
}

function compareLessThanOrEqual(actual: number | string, expected: unknown): boolean {
	if (typeof actual === 'number' && typeof expected === 'number') {
		return actual <= expected;
	}

	if (typeof actual === 'string' && typeof expected === 'string') {
		return actual <= expected;
	}

	return false;
}

function compareGreaterThan(actual: number | string, expected: unknown): boolean {
	if (typeof actual === 'number' && typeof expected === 'number') {
		return actual > expected;
	}

	if (typeof actual === 'string' && typeof expected === 'string') {
		return actual > expected;
	}

	return false;
}

function compareLessThan(actual: number | string, expected: unknown): boolean {
	if (typeof actual === 'number' && typeof expected === 'number') {
		return actual < expected;
	}

	if (typeof actual === 'string' && typeof expected === 'string') {
		return actual < expected;
	}

	return false;
}

function calculateAgeYears(birthday: string): number | undefined {
	const birthDate = new Date(birthday);

	if (Number.isNaN(birthDate.valueOf())) {
		return undefined;
	}

	const today = new Date();
	let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
	const monthDelta = today.getUTCMonth() - birthDate.getUTCMonth();

	if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < birthDate.getUTCDate())) {
		age -= 1;
	}

	return age;
}
