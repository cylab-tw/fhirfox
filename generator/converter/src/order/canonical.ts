import { readNormalizedSourceResourceType } from '../source-resource.js';

import type { ConverterRuleSet, FhirResource, GeneratorRuleRow, SourceResource } from '../types.js';

const encounterContextTypeOrder = ['organization', 'practitionerrole', 'practitioner'] as const;
const clinicalTypeOrder = [
	'condition',
	'allergyintolerance',
	'observation',
	'procedure',
	'diagnosticreport',
	'imagingstudy',
	'medication',
	'medicationrequest',
] as const;
const fallbackTypeOrder = ['patient', 'encounter', ...encounterContextTypeOrder, ...clinicalTypeOrder] as const;
const fhirTopLevelPrefix = ['resourceType', 'meta', 'implicitRules', 'language', 'text', 'contained', 'identifier'];

interface ParsedSegment {
	name: string;
	index?: number;
}

interface ResourceFieldMetadata {
	sourceOrder: string[];
	topLevelFhirOrder: string[];
	nestedOrderByPath: Map<string, string[]>;
}

export interface OrderedSourceResources<TResource> {
	orderedResources: TResource[];
	groupedResources: Record<string, TResource[]>;
}

export function orderSourceResources<TResource extends SourceResource>(
	resources: TResource[],
): OrderedSourceResources<TResource> {
	const byKey = new Map(resources.map((resource) => [toResourceKey(resource), resource] as const));
	const emitted = new Set<string>();
	const ordered: TResource[] = [];

	const patientIds = [...collectPatientIds(resources)].sort((left, right) =>
		comparePatientGroups(
			left,
			right,
			resources.filter((resource) => readPatientId(resource) === left),
			resources.filter((resource) => readPatientId(resource) === right),
		),
	);

	for (const patientId of patientIds) {
		const patient = byKey.get(`patient/${patientId}`);

		if (patient) {
			pushResource(ordered, emitted, patient);
		}

		const encounters = resources
			.filter((resource) => getResourceType(resource) === 'encounter' && readPatientId(resource) === patientId)
			.sort(compareChronologicalResource);

		for (const encounter of encounters) {
			pushResource(ordered, emitted, encounter);
		}

		pushEncounterGroupOrganizations(ordered, emitted, resources, encounters);
		pushEncounterGroupPractitionerRoles(ordered, emitted, resources, encounters);
		pushEncounterGroupPractitioners(ordered, emitted, resources, encounters);
		pushEncounterGroupClinicalResources(ordered, emitted, resources, encounters);

		pushPatientScopedClinicalResources(ordered, emitted, resources, patientId);
	}

	for (const resource of [...resources].sort(compareFallbackResource)) {
		pushResource(ordered, emitted, resource);
	}

	return {
		orderedResources: ordered,
		groupedResources: groupOrderedResources(ordered),
	};
}

export function orderSourceResourceFields<TResource extends SourceResource>(
	resource: TResource,
	ruleSet: ConverterRuleSet,
): TResource {
	const metadata = getResourceFieldMetadata(ruleSet).get(getSourceResourceType(resource));

	if (!metadata) {
		return reorderFlatObject(resource, ['id']) as TResource;
	}

	return reorderFlatObject(resource, metadata.sourceOrder) as TResource;
}

export function orderFhirResourceFields(
	resource: FhirResource,
	sourceResourceType: string,
	ruleSet: ConverterRuleSet,
): FhirResource {
	const metadata = getResourceFieldMetadata(ruleSet).get(sourceResourceType.toLowerCase());

	if (!metadata) {
		return reorderFhirValue(resource, '', undefined) as FhirResource;
	}

	return reorderFhirValue(resource, '', metadata) as FhirResource;
}

function getResourceFieldMetadata(ruleSet: ConverterRuleSet): Map<string, ResourceFieldMetadata> {
	const cached = (ruleSet as ConverterRuleSet & { canonicalFieldMetadata?: Map<string, ResourceFieldMetadata> })
		.canonicalFieldMetadata;

	if (cached) {
		return cached;
	}

	const built = new Map<string, ResourceFieldMetadata>();
	const sourceFieldOrder = ruleSet.sourceFieldOrder ?? {};

	for (const [resourceType, rules] of ruleSet.generatorRulesByResourceType.entries()) {
		const normalizedResourceType = resourceType.toLowerCase();
		const sourceOrder = [...(sourceFieldOrder[normalizedResourceType] ?? [])];
		const topLevelFhirOrder: string[] = [...fhirTopLevelPrefix];
		const nestedOrderByPath = new Map<string, string[]>();
		const orderedRules = [...rules].sort((left, right) => compareRuleBySourceFieldOrder(left, right, sourceOrder));

		for (const rule of orderedRules) {
			const parsed = parseFhirRulePath(rule);

			for (const segment of parsed.segments) {
				const parentPath = normalizeObjectPath(parsed.segments.slice(0, parsed.segments.indexOf(segment)));
				appendOrderEntry(nestedOrderByPath, parentPath, segment.name);
			}

			appendOrderEntry(topLevelFhirOrder, parsed.segments[0]?.name);

			if (rule.transformKind === 'code_map') {
				const leafParentPath = normalizeObjectPath(parsed.segments.slice(0, -1));
				prependOrderEntry(nestedOrderByPath, leafParentPath, 'system');
				appendOrderEntry(nestedOrderByPath, leafParentPath, 'code');
				appendOrderEntry(nestedOrderByPath, leafParentPath, 'display');
			}

			appendOrderEntry(sourceOrder, rule.sourceColumn);
		}

		built.set(resourceType.toLowerCase(), {
			sourceOrder,
			topLevelFhirOrder,
			nestedOrderByPath,
		});
	}

	(
		ruleSet as ConverterRuleSet & { canonicalFieldMetadata?: Map<string, ResourceFieldMetadata> }
	).canonicalFieldMetadata = built;
	return built;
}

function parseFhirRulePath(rule: GeneratorRuleRow): { resourceType: string; segments: ParsedSegment[] } {
	const parts = rule.fhirPath.split('.');
	const resourceType = parts.shift();

	if (!resourceType || parts.length === 0) {
		throw new Error(`Unsupported FHIR path "${rule.fhirPath}".`);
	}

	return {
		resourceType,
		segments: parts.map((part) => {
			const [nameWithIndex] = part.split(':', 1);
			const match = /^(?<name>[A-Za-z][A-Za-z0-9]*)(?:\[(?<index>\d+)\])?$/u.exec(nameWithIndex ?? '');

			if (!match?.groups) {
				throw new Error(`Unsupported FHIR path segment "${part}".`);
			}

			return {
				name: match.groups.name,
				index: match.groups.index === undefined ? undefined : Number.parseInt(match.groups.index, 10),
			};
		}),
	};
}

function normalizeObjectPath(segments: ParsedSegment[]): string {
	return segments.map((segment) => (segment.index === undefined ? segment.name : `${segment.name}[]`)).join('.');
}

function appendOrderEntry(target: string[], value: string | undefined): void;
function appendOrderEntry(target: Map<string, string[]>, path: string, value: string): void;
function appendOrderEntry(
	target: string[] | Map<string, string[]>,
	pathOrValue: string | undefined,
	value?: string,
): void {
	if (Array.isArray(target)) {
		if (!pathOrValue || target.includes(pathOrValue)) {
			return;
		}

		target.push(pathOrValue);
		return;
	}

	if (pathOrValue === undefined || value === undefined) {
		return;
	}

	const entries = target.get(pathOrValue) ?? [];

	if (!entries.includes(value)) {
		entries.push(value);
		target.set(pathOrValue, entries);
	}
}

function prependOrderEntry(target: Map<string, string[]>, path: string, value: string): void {
	const entries = target.get(path) ?? [];

	if (entries.includes(value)) {
		entries.splice(entries.indexOf(value), 1);
	}

	entries.unshift(value);
	target.set(path, entries);
}

function reorderFlatObject(value: Record<string, unknown>, preferredOrder: string[]): Record<string, unknown> {
	const ordered: Record<string, unknown> = {};

	for (const key of preferredOrder) {
		if (key in value && !key.startsWith('__')) {
			ordered[key] = value[key];
		}
	}

	for (const [key, fieldValue] of Object.entries(value)) {
		if (!key.startsWith('__') && !(key in ordered)) {
			ordered[key] = fieldValue;
		}
	}

	return ordered;
}

function reorderFhirValue(value: unknown, path: string, metadata: ResourceFieldMetadata | undefined): unknown {
	if (Array.isArray(value)) {
		return value.map((entry) => {
			if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
				return entry;
			}

			const itemPath = path.length > 0 ? `${path}[]` : '[]';
			return reorderFhirValue(entry, itemPath, metadata);
		});
	}

	if (typeof value !== 'object' || value === null) {
		return value;
	}

	const record = value as Record<string, unknown>;
	const preferredOrder =
		path.length === 0 ? metadata?.topLevelFhirOrder : resolveNestedFieldOrder(path, record, metadata);
	const ordered = reorderFlatObject(record, preferredOrder ?? []);

	if (path.length === 0 && typeof (record as FhirResource).__sourceId === 'string') {
		Object.defineProperty(ordered, '__sourceId', {
			value: (record as FhirResource).__sourceId,
			enumerable: false,
			configurable: true,
			writable: true,
		});
	}

	for (const [key, fieldValue] of Object.entries(ordered)) {
		const childPath = path.length === 0 ? key : `${path}.${key}`;
		ordered[key] = reorderFhirValue(fieldValue, childPath, metadata);
	}

	return ordered;
}

function resolveNestedFieldOrder(
	path: string,
	record: Record<string, unknown>,
	metadata: ResourceFieldMetadata | undefined,
): string[] | undefined {
	void record;
	const normalizedPath = path.startsWith('[].') ? path.slice(3) : path;
	return metadata?.nestedOrderByPath.get(normalizedPath);
}

function compareRuleBySourceFieldOrder(left: GeneratorRuleRow, right: GeneratorRuleRow, sourceOrder: string[]): number {
	const leftIndex = sourceOrder.indexOf(left.sourceColumn);
	const rightIndex = sourceOrder.indexOf(right.sourceColumn);
	const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
	const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

	return normalizedLeft - normalizedRight || left.sortOrder - right.sortOrder;
}

function pushEncounterGroupOrganizations<TResource extends SourceResource>(
	ordered: TResource[],
	emitted: Set<string>,
	resources: TResource[],
	encounters: TResource[],
): void {
	const organizationIds = unique(
		encounters
			.map((encounter) => readString(encounter.serviceProviderId))
			.filter((value): value is string => value !== undefined),
	);

	for (const organizationId of organizationIds) {
		const organization = resources.find(
			(resource) => getResourceType(resource) === 'organization' && resource.id === organizationId,
		);

		if (organization) {
			pushResource(ordered, emitted, organization);
		}
	}
}

function pushEncounterGroupPractitionerRoles<TResource extends SourceResource>(
	ordered: TResource[],
	emitted: Set<string>,
	resources: TResource[],
	encounters: TResource[],
): void {
	const organizationIds = new Set(
		encounters
			.map((encounter) => readString(encounter.serviceProviderId))
			.filter((value): value is string => value !== undefined),
	);
	const practitionerIds = new Set(
		encounters
			.map((encounter) => readString(encounter.practitionerId))
			.filter((value): value is string => value !== undefined),
	);
	const roles = resources
		.filter((resource) => getResourceType(resource) === 'practitionerrole')
		.filter((resource) => {
			const resourceOrganizationId = readString(resource.organizationId);
			const resourcePractitionerId = readString(resource.practitionerId);
			const matchesOrganization =
				organizationIds.size > 0
					? resourceOrganizationId !== undefined && organizationIds.has(resourceOrganizationId)
					: true;
			const matchesPractitioner =
				practitionerIds.size > 0
					? resourcePractitionerId !== undefined && practitionerIds.has(resourcePractitionerId)
					: true;
			return matchesOrganization && matchesPractitioner;
		})
		.sort(compareChronologicalResource);

	for (const role of roles) {
		pushResource(ordered, emitted, role);
	}
}

function pushEncounterGroupPractitioners<TResource extends SourceResource>(
	ordered: TResource[],
	emitted: Set<string>,
	resources: TResource[],
	encounters: TResource[],
): void {
	const practitionerIds = new Set<string>();

	for (const encounter of encounters) {
		const directPractitionerId = readString(encounter.practitionerId);

		if (directPractitionerId) {
			practitionerIds.add(directPractitionerId);
		}
	}

	for (const role of resources.filter((resource) => getResourceType(resource) === 'practitionerrole')) {
		const rolePractitionerId = readString(role.practitionerId);
		const roleOrganizationId = readString(role.organizationId);
		const encounterOrganizationIds = new Set(
			encounters
				.map((encounter) => readString(encounter.serviceProviderId))
				.filter((value): value is string => value !== undefined),
		);

		if (
			rolePractitionerId &&
			(roleOrganizationId === undefined || encounterOrganizationIds.has(roleOrganizationId)) &&
			practitionerIds.has(rolePractitionerId)
		) {
			practitionerIds.add(rolePractitionerId);
		}
	}

	for (const practitionerId of [...practitionerIds].sort((left, right) => left.localeCompare(right))) {
		const practitioner = resources.find(
			(resource) => getResourceType(resource) === 'practitioner' && resource.id === practitionerId,
		);

		if (practitioner) {
			pushResource(ordered, emitted, practitioner);
		}
	}
}

function pushEncounterGroupClinicalResources<TResource extends SourceResource>(
	ordered: TResource[],
	emitted: Set<string>,
	resources: TResource[],
	encounters: TResource[],
): void {
	const encounterIds = encounters.map((encounter) => encounter.id);

	for (const resourceType of clinicalTypeOrder) {
		const referencedIds = encounters.flatMap((encounter) => getEncounterReferencedIds(encounter, resourceType));
		const clinicalResources = resources
			.filter(
				(resource) =>
					getResourceType(resource) === resourceType &&
					readString(resource.encounterId) !== undefined &&
					encounterIds.includes(readString(resource.encounterId) as string),
			)
			.sort((left, right) => compareEncounterClinicalResources(left, right, referencedIds));

		for (const resource of clinicalResources) {
			pushResource(ordered, emitted, resource);
		}
	}
}

function pushPatientScopedClinicalResources<TResource extends SourceResource>(
	ordered: TResource[],
	emitted: Set<string>,
	resources: TResource[],
	patientId: string,
): void {
	for (const resourceType of clinicalTypeOrder) {
		const clinicalResources = resources
			.filter(
				(resource) =>
					getResourceType(resource) === resourceType &&
					readPatientId(resource) === patientId &&
					readString(resource.encounterId) === undefined,
			)
			.sort(compareChronologicalResource);

		for (const resource of clinicalResources) {
			pushResource(ordered, emitted, resource);
		}
	}
}

function collectPatientIds<TResource extends SourceResource>(resources: TResource[]): Set<string> {
	const patientIds = new Set<string>();

	for (const resource of resources) {
		if (getResourceType(resource) === 'patient') {
			patientIds.add(resource.id);
			continue;
		}

		const patientId = readPatientId(resource);

		if (patientId) {
			patientIds.add(patientId);
		}
	}

	return patientIds;
}

function comparePatientGroups(
	leftPatientId: string,
	rightPatientId: string,
	leftResources: SourceResource[],
	rightResources: SourceResource[],
): number {
	const leftEncounterDate = getGroupEncounterDate(leftResources);
	const rightEncounterDate = getGroupEncounterDate(rightResources);
	return leftEncounterDate.localeCompare(rightEncounterDate) || leftPatientId.localeCompare(rightPatientId);
}

function getGroupEncounterDate(resources: SourceResource[]): string {
	const encounterDates = resources
		.filter((resource) => getResourceType(resource) === 'encounter')
		.map((resource) => getChronologicalKey(resource))
		.filter((value): value is string => value !== undefined)
		.sort((left, right) => left.localeCompare(right));

	return encounterDates[0] ?? '9999-12-31T23:59:59.999Z';
}

function compareEncounterClinicalResources(
	left: SourceResource,
	right: SourceResource,
	referencedIds: string[],
): number {
	const leftReferenceIndex = referencedIds.indexOf(left.id);
	const rightReferenceIndex = referencedIds.indexOf(right.id);
	const leftRank = leftReferenceIndex === -1 ? Number.MAX_SAFE_INTEGER : leftReferenceIndex;
	const rightRank = rightReferenceIndex === -1 ? Number.MAX_SAFE_INTEGER : rightReferenceIndex;

	return leftRank - rightRank || compareChronologicalResource(left, right);
}

function getEncounterReferencedIds(resource: SourceResource, resourceType: string): string[] {
	switch (resourceType) {
		case 'condition':
			return [readString(resource.conditionId)].filter((value): value is string => value !== undefined);
		default:
			return [];
	}
}

function compareFallbackResource(left: SourceResource, right: SourceResource): number {
	const typeComparison = compareResourceType(left, right);
	return typeComparison || compareChronologicalResource(left, right);
}

function compareResourceType(left: SourceResource, right: SourceResource): number {
	return getTypeRank(getResourceType(left)) - getTypeRank(getResourceType(right));
}

function getTypeRank(resourceType: string): number {
	const index = fallbackTypeOrder.indexOf(resourceType as (typeof fallbackTypeOrder)[number]);
	return index === -1 ? fallbackTypeOrder.length + 1 : index;
}

function compareChronologicalResource(left: SourceResource, right: SourceResource): number {
	return (
		(getChronologicalKey(left) ?? '9999-12-31T23:59:59.999Z').localeCompare(
			getChronologicalKey(right) ?? '9999-12-31T23:59:59.999Z',
		) || left.id.localeCompare(right.id)
	);
}

function getChronologicalKey(resource: SourceResource): string | undefined {
	switch (getResourceType(resource)) {
		case 'encounter':
			return readString(resource.periodStart) ?? readString(resource.periodEnd);
		case 'condition':
			return readString(resource.onsetDate) ?? readString(resource.recordedDate);
		case 'allergyintolerance':
			return readString(resource.onsetDate) ?? readString(resource.recordedDate);
		case 'observation':
			return readString(resource.effectiveDate);
		case 'procedure':
			return readString(resource.performedDate);
		case 'practitionerrole':
			return readString(resource.periodStart);
		default:
			return undefined;
	}
}

function groupOrderedResources<TResource extends SourceResource>(resources: TResource[]): Record<string, TResource[]> {
	const grouped: Record<string, TResource[]> = {};

	for (const resource of resources) {
		const resourceType = getResourceType(resource);
		grouped[resourceType] ??= [];
		grouped[resourceType].push(resource);
	}

	return grouped;
}

function pushResource<TResource extends SourceResource>(
	ordered: TResource[],
	emitted: Set<string>,
	resource: TResource,
): void {
	const key = toResourceKey(resource);

	if (emitted.has(key)) {
		return;
	}

	emitted.add(key);
	ordered.push(resource);
}

function toResourceKey(resource: SourceResource): string {
	return `${getResourceType(resource)}/${resource.id}`;
}

function getSourceResourceType(resource: SourceResource): string {
	return getResourceType(resource);
}

function getResourceType(resource: SourceResource): string {
	return readNormalizedSourceResourceType(resource);
}

function readPatientId(resource: SourceResource): string | undefined {
	if (getResourceType(resource) === 'patient') {
		return resource.id;
	}

	return readString(resource.patientId) ?? readString(resource.patient_id);
}

function readString(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function unique(values: string[]): string[] {
	return [...new Set(values)];
}
