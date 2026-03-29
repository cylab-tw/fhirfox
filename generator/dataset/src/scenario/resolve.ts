import type { Dataset, Resource, ResourceType } from '../resources/index.js';
import type { ResolvedScenario, Scenario, ScenarioResourceSelection, ScenarioSelection } from './scenario.js';
import type { DatasetProvider } from '../providers/index.js';
import type { ResourceLinks } from '../resources/index.js';

/**
 * Resolves one scenario into concrete source resources from a dataset provider.
 *
 * Resolution starts with the direct matches from scenario filters, then expands
 * through declared source-data links so the final result includes related
 * records from the same clinical event.
 */
export async function resolveScenario(provider: DatasetProvider, scenario: Scenario): Promise<ResolvedScenario> {
	const resolved: Partial<Record<ResourceType, Resource[]>> = {};
	const warningSet = new Set<string>();
	const links = await provider.listResourceLinks();

	for (const [resourceType, selection] of Object.entries(scenario.resources)) {
		const filters = normalizeSelection(selection);
		const matches = await Promise.all(filters.map((filter) => provider.queryResources(resourceType, filter)));

		resolved[resourceType] = dedupeResources(matches.flat());
	}

	const directResources = dedupeResources(Object.values(resolved).flatMap((resources) => resources ?? []));
	const selectedSeeds = applySelectionPolicy(directResources, scenario.selection);

	if (selectedSeeds.length === 0) {
		return {
			scenario,
			resources: {},
			orderedResources: [],
			warnings:
				Object.keys(scenario.resources).length > 0
					? ['Scenario produced no direct matches, so linked expansion was skipped.']
					: undefined,
			meta: {
				directMatchCount: 0,
				expandedMatchCount: 0,
			},
		};
	}

	const expandedResources =
		scenario.selection?.expandLinks === false
			? selectedSeeds
			: await buildClinicalScope(provider, selectedSeeds, links, warningSet, scenario.selection);
	const groupedResources = groupResources(expandedResources);
	const warnings = [...warningSet];

	return {
		scenario,
		resources: groupedResources,
		orderedResources: expandedResources,
		warnings: warnings.length > 0 ? warnings : undefined,
		meta: {
			directMatchCount: selectedSeeds.length,
			expandedMatchCount: expandedResources.length,
		},
	};
}

function normalizeSelection(selection: ScenarioResourceSelection): Dataset[] {
	return Array.isArray(selection) ? selection : [selection];
}

function dedupeResources(resources: Resource[]): Resource[] {
	const byKey = new Map<string, Resource>();

	for (const resource of resources) {
		byKey.set(`${resource.type}/${resource.id}`, resource);
	}

	return [...byKey.values()];
}

async function buildClinicalScope(
	provider: DatasetProvider,
	seeds: Resource[],
	links: ResourceLinks,
	warnings: Set<string>,
	selection?: ScenarioSelection,
): Promise<Resource[]> {
	const matchLinkTargetTypes = createLinkTargetMatcher(provider);
	const scoped = new Map<string, Resource>();
	addResources(scoped, seeds);

	const allowedPatientIds = [...new Set(selectPatientIds(seeds, selection?.maxPatients ?? 1, selection?.strategy))];

	const encounterIds = await resolveEncounterScope(
		provider,
		seeds,
		allowedPatientIds,
		links,
		warnings,
		matchLinkTargetTypes,
	);
	const limitedEncounterIds = applyEncounterLimit(encounterIds, selection?.maxLinkedEncounters);
	const encounterResources = await loadByIds(provider, 'encounter', limitedEncounterIds);
	addResources(scoped, encounterResources);

	const patientScopeIds = [
		...new Set([...allowedPatientIds, ...collectIds(encounterResources, ['patientId', 'patient_id'])]),
	];
	const patientResources = await loadByIds(provider, 'patient', patientScopeIds);
	addResources(scoped, patientResources);

	const organizationIds = collectIds(encounterResources, ['serviceProviderId']);
	const organizationResources = await loadByIds(provider, 'organization', organizationIds);
	addResources(scoped, organizationResources);

	const clinicalResources = await loadClinicalResources(
		provider,
		links,
		patientScopeIds,
		limitedEncounterIds,
		warnings,
		matchLinkTargetTypes,
	);
	addResources(scoped, clinicalResources);

	const practitionerIds = new Set<string>([
		...collectIds(encounterResources, ['practitionerId']),
		...collectIds(clinicalResources, ['recorderId', 'performerId']),
	]);
	const practitionerResources = await loadByIds(provider, 'practitioner', [...practitionerIds]);
	addResources(scoped, practitionerResources);

	const practitionerRoleResources = await loadPractitionerRoles(
		provider,
		links,
		[...practitionerIds],
		organizationIds,
		warnings,
		matchLinkTargetTypes,
	);
	addResources(scoped, practitionerRoleResources);

	return [...scoped.values()];
}

function applySelectionPolicy(resources: Resource[], selection?: ScenarioSelection): Resource[] {
	const strategy = selection?.strategy ?? 'best-match';
	let selected = resources;

	if (selection?.maxSeeds && selection.maxSeeds > 0 && resources.length > selection.maxSeeds) {
		selected =
			strategy === 'grouped-by-patient'
				? selectGroupedByPatient(resources, selection.maxSeeds)
				: selectBestMatch(resources, selection.maxSeeds);
	}

	if (selection?.maxPatients && selection.maxPatients > 0) {
		selected = limitPatients(selected, selection.maxPatients, strategy);
	}

	return selected;
}

function selectBestMatch(resources: Resource[], maxSeeds: number): Resource[] {
	return [...resources]
		.sort((left, right) => compareSeedPriority(left, right) || left.id.localeCompare(right.id))
		.slice(0, maxSeeds);
}

function selectGroupedByPatient(resources: Resource[], maxSeeds: number): Resource[] {
	const patients = resources
		.filter((resource) => resource.type === 'patient')
		.sort((left, right) => left.id.localeCompare(right.id))
		.slice(0, maxSeeds);

	if (patients.length > 0) {
		return patients;
	}

	return selectBestMatch(resources, maxSeeds);
}

function compareSeedPriority(left: Resource, right: Resource): number {
	return getSeedPriority(left.type) - getSeedPriority(right.type);
}

function getSeedPriority(resourceType: Resource['type']): number {
	switch (resourceType) {
		case 'procedure':
			return 0;
		case 'condition':
			return 1;
		case 'observation':
			return 2;
		case 'allergyintolerance':
			return 3;
		case 'encounter':
			return 4;
		case 'patient':
			return 5;
		default:
			return 6;
	}
}

function limitPatients(
	resources: Resource[],
	maxPatients: number,
	strategy: ScenarioSelection['strategy'],
): Resource[] {
	const allowedPatientIds = [...new Set(selectPatientIds(resources, maxPatients, strategy))];

	if (allowedPatientIds.length === 0) {
		return resources;
	}

	return resources.filter((resource) => {
		const patientId = getPatientId(resource);
		return patientId === undefined || allowedPatientIds.includes(patientId);
	});
}

function selectPatientIds(
	resources: Resource[],
	maxPatients: number,
	strategy: ScenarioSelection['strategy'],
): string[] {
	const patientResources = resources.filter((resource) => resource.type === 'patient');

	if (patientResources.length > 0) {
		const selectedPatients =
			strategy === 'grouped-by-patient'
				? patientResources.sort((left, right) => left.id.localeCompare(right.id))
				: [...patientResources].sort((left, right) => left.id.localeCompare(right.id));

		return selectedPatients.slice(0, maxPatients).map((resource) => resource.id);
	}

	const encounterPatients = resources
		.filter(
			(resource): resource is Resource & { patientId: string } =>
				resource.type === 'encounter' && typeof resource.patientId === 'string',
		)
		.map((resource) => resource.patientId);

	return [...new Set(encounterPatients)].slice(0, maxPatients);
}

function getPatientId(resource: Resource): string | undefined {
	if (resource.type === 'patient') {
		return resource.id;
	}

	return getFirstString(resource, ['patientId', 'patient_id']);
}

async function resolveEncounterScope(
	provider: DatasetProvider,
	seeds: Resource[],
	allowedPatientIds: string[],
	links: ResourceLinks,
	warnings: Set<string>,
	matchLinkTargetTypes: LinkTargetMatcher,
): Promise<string[]> {
	const encounterIds = new Set<string>();
	const encounterSeedIds = seeds.filter((resource) => resource.type === 'encounter').map((resource) => resource.id);

	for (const id of encounterSeedIds) {
		encounterIds.add(id);
	}

	for (const resource of seeds) {
		const encounterId = getEncounterId(resource);

		if (!encounterId) {
			continue;
		}

		const matches = await provider.queryResources('encounter', { id: encounterId });

		if (matches.length === 0) {
			warnings.add(
				`Missing linked resource encounter/${encounterId} from ${resource.type}/${resource.id} via ${getEncounterField(resource)}.`,
			);
			continue;
		}

		for (const match of matches) {
			const patientId = getPatientId(match);

			if (allowedPatientIds.length === 0 || (patientId && allowedPatientIds.includes(patientId))) {
				encounterIds.add(match.id);
			}
		}
	}

	if (encounterIds.size === 0 && allowedPatientIds.length > 0) {
		const reverseMatches = await loadLinkedResources(
			provider,
			links,
			'encounter',
			'patient',
			allowedPatientIds,
			warnings,
			matchLinkTargetTypes,
		);

		for (const match of reverseMatches) {
			encounterIds.add(match.id);
		}
	}

	return [...encounterIds];
}

function applyEncounterLimit(encounterIds: string[], maxLinkedEncounters: number | undefined): string[] {
	if (!maxLinkedEncounters || encounterIds.length <= maxLinkedEncounters) {
		return encounterIds;
	}

	return [...encounterIds].sort((left, right) => left.localeCompare(right)).slice(0, maxLinkedEncounters);
}

async function loadClinicalResources(
	provider: DatasetProvider,
	links: ResourceLinks,
	allowedPatientIds: string[],
	allowedEncounterIds: string[],
	warnings: Set<string>,
	matchLinkTargetTypes: LinkTargetMatcher,
): Promise<Resource[]> {
	const clinicalTypes: ResourceType[] = ['condition', 'allergyintolerance', 'observation', 'procedure'];
	const results: Resource[] = [];

	for (const resourceType of clinicalTypes) {
		const patientLinked = await loadLinkedResources(
			provider,
			links,
			resourceType,
			'patient',
			allowedPatientIds,
			warnings,
			matchLinkTargetTypes,
		);
		const encounterLinked = await loadLinkedResources(
			provider,
			links,
			resourceType,
			'encounter',
			allowedEncounterIds,
			warnings,
			matchLinkTargetTypes,
		);
		const scoped = dedupeResources([...patientLinked, ...encounterLinked]).filter((resource) =>
			isClinicalResourceInScope(resource, allowedPatientIds, allowedEncounterIds),
		);

		results.push(...scoped);
	}

	return results;
}

async function loadPractitionerRoles(
	provider: DatasetProvider,
	links: ResourceLinks,
	practitionerIds: string[],
	organizationIds: string[],
	warnings: Set<string>,
	matchLinkTargetTypes: LinkTargetMatcher,
): Promise<Resource[]> {
	const fromPractitioner = await loadLinkedResources(
		provider,
		links,
		'practitionerrole',
		'practitioner',
		practitionerIds,
		warnings,
		matchLinkTargetTypes,
	);
	const fromOrganization = await loadLinkedResources(
		provider,
		links,
		'practitionerrole',
		'organization',
		organizationIds,
		warnings,
		matchLinkTargetTypes,
	);

	return dedupeResources([...fromPractitioner, ...fromOrganization]).filter((resource) => {
		const practitionerId = getFirstString(resource, ['practitionerId', 'practitioner_id']);
		const organizationId = getFirstString(resource, ['organizationId', 'organization_id']);

		return (
			practitionerId !== undefined &&
			organizationId !== undefined &&
			practitionerIds.includes(practitionerId) &&
			organizationIds.includes(organizationId)
		);
	});
}

async function loadLinkedResources(
	provider: DatasetProvider,
	links: ResourceLinks,
	sourceType: ResourceType,
	targetType: ResourceType,
	targetIds: string[],
	warnings: Set<string>,
	matchLinkTargetTypes: LinkTargetMatcher,
): Promise<Resource[]> {
	const relevantLinks = links.filter((link) => link.sourceType === sourceType && link.targetTypes.includes(targetType));
	const results: Resource[] = [];

	for (const targetId of targetIds) {
		for (const link of relevantLinks) {
			const matches = await provider.queryLinkedResources(sourceType, link.field, targetId);

			for (const match of matches) {
				const explicitTargetType = readLinkTargetType(match, link.field);

				if (explicitTargetType) {
					if (link.targetTypes.includes(explicitTargetType) && explicitTargetType === targetType) {
						results.push(match);
					}
					continue;
				}

				const matchedTargetTypes = await matchLinkTargetTypes(link, targetId);

				if (matchedTargetTypes.length > 1) {
					warnings.add(
						`Ambiguous linked resource id "${targetId}" for ${sourceType}.${link.field}; matched target types: ${matchedTargetTypes.join(', ')}.`,
					);
					continue;
				}

				if (matchedTargetTypes[0] === targetType) {
					results.push(match);
				}
			}
		}
	}

	return results;
}

async function loadByIds(provider: DatasetProvider, resourceType: ResourceType, ids: string[]): Promise<Resource[]> {
	const results = await Promise.all(ids.map((id) => provider.queryResources(resourceType, { id })));
	return dedupeResources(results.flat());
}

function isClinicalResourceInScope(
	resource: Resource,
	allowedPatientIds: string[],
	allowedEncounterIds: string[],
): boolean {
	const patientId = getPatientId(resource);
	const encounterId = getEncounterId(resource);

	if (patientId && allowedPatientIds.length > 0 && !allowedPatientIds.includes(patientId)) {
		return false;
	}

	if (encounterId) {
		return allowedEncounterIds.includes(encounterId);
	}

	return patientId === undefined || allowedPatientIds.includes(patientId);
}

function addResources(store: Map<string, Resource>, resources: Resource[]): void {
	for (const resource of resources) {
		store.set(toResourceKey(resource), resource);
	}
}

function collectIds(resources: Resource[], fields: string[]): string[] {
	const ids = new Set<string>();

	for (const resource of resources) {
		for (const field of fields) {
			const value = resource[field];

			if (typeof value === 'string' && value.length > 0) {
				ids.add(value);
			}
		}
	}

	return [...ids];
}

function getEncounterId(resource: Resource): string | undefined {
	return getFirstString(resource, ['encounterId', 'encounter_id']);
}

function getEncounterField(resource: Resource): string {
	return typeof resource.encounterId === 'string' ? 'encounterId' : 'encounter_id';
}

function getFirstString(resource: Resource, fields: string[]): string | undefined {
	for (const field of fields) {
		const value = resource[field];

		if (typeof value === 'string' && value.length > 0) {
			return value;
		}
	}

	return undefined;
}

function groupResources(resources: Resource[]): Partial<Record<ResourceType, Resource[]>> {
	const grouped: Partial<Record<ResourceType, Resource[]>> = {};

	for (const resource of resources) {
		grouped[resource.type] ??= [];
		grouped[resource.type]?.push(resource);
	}

	return grouped;
}

function toResourceKey(resource: Resource): string {
	return `${resource.type}/${resource.id}`;
}

type LinkTargetMatcher = (link: ResourceLinks[number], targetId: string) => Promise<ResourceType[]>;

function createLinkTargetMatcher(provider: DatasetProvider): LinkTargetMatcher {
	const cache = new Map<string, boolean>();

	return async (link, targetId) => {
		const matchedTypes = await Promise.all(
			link.targetTypes.map(async (targetType) => {
				const cacheKey = `${targetType}/${targetId}`;

				if (!cache.has(cacheKey)) {
					const matches = await provider.queryResources(targetType, { id: targetId });
					cache.set(cacheKey, matches.length > 0);
				}

				return cache.get(cacheKey) ? targetType : undefined;
			}),
		);

		return matchedTypes.filter((entry): entry is ResourceType => entry !== undefined);
	};
}

function readLinkTargetType(resource: Resource, field: string): ResourceType | undefined {
	const typeField = field.endsWith('Id') ? `${field.slice(0, -2)}Type` : `${field}Type`;
	const value = resource[typeField];
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}
