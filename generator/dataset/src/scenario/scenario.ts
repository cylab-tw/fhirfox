import type { Dataset, Resource, ResourceType } from '../resources/index.js';
import { validateScenarioDocument } from './authoring.js';

export type ScenarioLevel = number;

/**
 * Describes a clinical event that can be used to query the source dataset.
 *
 * A scenario does not define FHIR output. It captures the clinical context used
 * to select source resources that will later be converted elsewhere.
 */
export interface ScenarioMetadata {
	/**
	 * Identifies the clinical scenario across listing and execution.
	 */
	id: string;

	/**
	 * Gives the clinical scenario a human-facing label.
	 */
	displayName: string;

	/**
	 * Classifies the scenario at a business or workflow level.
	 *
	 * Kept open for now because the exact scenario categories may evolve.
	 */
	type: string;

	/**
	 * Gives a short overview of the clinical event the scenario is intended to model.
	 */
	summary?: string;

	/**
	 * Provides longer narrative context, assumptions, or notes for the scenario.
	 */
	details?: string;

	/**
	 * Positions the scenario in the implementation ladder used by the project.
	 */
	level?: ScenarioLevel;

	/**
	 * Optional execution controls that constrain how many matching seeds and
	 * linked resources a scenario should expand into.
	 */
	selection?: ScenarioSelection;
}

export interface ScenarioSelection {
	strategy?: 'best-match' | 'grouped-by-patient';
	maxSeeds?: number;
	maxPatients?: number;
	maxLinkedEncounters?: number;
	expandLinks?: boolean;
}

/**
 * One resource selection entry in a scenario.
 *
 * The value is a source-data filter, or a list of filters, for one resource
 * type in the source dataset.
 */
export type ScenarioResourceSelection = Dataset | Dataset[];

/**
 * YAML-facing scenario shape.
 *
 * Resource selections stay at the top level in YAML for authoring convenience,
 * so this type allows resource-specific keys alongside the scenario metadata.
 */
export type ScenarioDocument = Record<string, unknown> & {
	id: string;
	type: string;
	name: string;
	summary?: string;
	details?: string;
	level?: ScenarioLevel;
	selection?: ScenarioSelection;
};

/**
 * Normalized scenario shape used inside the dataset package.
 *
 * Resource selections are grouped under `resources` so runtime code can work
 * with them without colliding with metadata keys from the YAML document.
 */
export interface Scenario extends ScenarioMetadata {
	resources: Record<ResourceType, ScenarioResourceSelection>;
}

/**
 * Result of resolving a scenario against a source dataset.
 *
 * The selected resources remain source-side records. FHIR conversion is a later
 * concern outside this package.
 */
export interface ResolvedScenario {
	scenario: Scenario;
	resources: Partial<Record<ResourceType, Resource[]>>;
	orderedResources: Resource[];
	warnings?: string[];
	meta?: {
		directMatchCount: number;
		expandedMatchCount: number;
	};
}

/**
 * Converts a YAML-shaped scenario document into the normalized runtime shape.
 *
 * Top-level keys that are not scenario metadata and whose values look like
 * filter objects are treated as resource selections.
 */
export function normalizeScenario(document: ScenarioDocument): Scenario {
	assertScenarioMetadata(document);

	const { id, type } = document;
	const displayName = getScenarioDisplayName(document);
	const resources = compileScenarioResources(document);

	return {
		id,
		displayName,
		type,
		summary: getScenarioSummary(document),
		details: document.details,
		level: getScenarioLevel(document),
		selection: document.selection,
		resources,
	};
}

function compileScenarioResources(document: ScenarioDocument): Record<ResourceType, ScenarioResourceSelection> {
	const resources: Record<ResourceType, ScenarioResourceSelection> = {};
	const hasSpecificClinicalAnchors =
		document.condition !== undefined ||
		document.procedure !== undefined ||
		document.observation !== undefined ||
		document.allergyIntolerance !== undefined ||
		document.medication !== undefined ||
		document.medicationRequest !== undefined ||
		document.diagnosticReport !== undefined ||
		document.imagingStudy !== undefined;

	const patientSelection = compilePatientSelection(document.patient, document.encounter);

	if (patientSelection) {
		resources.patient = patientSelection;
	}

	if (!hasSpecificClinicalAnchors) {
		const encounterSelection = compileEncounterSelection(document.encounter);

		if (encounterSelection) {
			resources.encounter = encounterSelection;
		}
	}

	const conditionSelection = compileSelection(document.condition, compileConditionFilter);

	if (conditionSelection) {
		resources.condition = conditionSelection;
	}

	const allergySelection = compileSelection(document.allergyIntolerance, compileAllergyFilter);

	if (allergySelection) {
		resources.allergyintolerance = allergySelection;
	}

	const observationSelection = compileSelection(document.observation, compileObservationFilter);

	if (observationSelection) {
		resources.observation = observationSelection;
	}

	const procedureSelection = compileSelection(document.procedure, compileProcedureFilter);

	if (procedureSelection) {
		resources.procedure = procedureSelection;
	}

	const medicationSelection = compileSelection(document.medication, compileGenericResourceFilter);

	if (medicationSelection) {
		resources.medication = medicationSelection;
	}

	const medicationRequestSelection = compileSelection(document.medicationRequest, compileGenericResourceFilter);

	if (medicationRequestSelection) {
		resources.medicationrequest = medicationRequestSelection;
	}

	const diagnosticReportSelection = compileSelection(document.diagnosticReport, compileGenericResourceFilter);

	if (diagnosticReportSelection) {
		resources.diagnosticreport = diagnosticReportSelection;
	}

	const imagingStudySelection = compileSelection(document.imagingStudy, compileGenericResourceFilter);

	if (imagingStudySelection) {
		resources.imagingstudy = imagingStudySelection;
	}

	return resources;
}

function compilePatientSelection(patient: unknown, encounter: unknown): ScenarioResourceSelection | undefined {
	if (!isDataset(patient)) {
		return undefined;
	}

	const compiled = compilePatientFilter(patient);

	if (!compiled) {
		return undefined;
	}

	if (compiled.samePerson === true && isDataset(encounter)) {
		const linkedEncounter = compileEncounterFilter(encounter);

		if (linkedEncounter) {
			const encounterCount = isDataset(encounter.count) ? encounter.count : undefined;

			compiled.samePersonEncounter = linkedEncounter;

			if (encounterCount) {
				compiled.samePersonEncounterCount = encounterCount;
			}
		}
	}

	return compiled;
}

function compileEncounterSelection(encounter: unknown): ScenarioResourceSelection | undefined {
	return compileSelection(encounter, compileEncounterFilter);
}

function compileSelection(
	value: unknown,
	compiler: (entry: Dataset) => Dataset | undefined,
): ScenarioResourceSelection | undefined {
	if (isDataset(value)) {
		return compiler(value);
	}

	if (!Array.isArray(value)) {
		return undefined;
	}

	const compiled = value
		.filter((entry): entry is Dataset => isDataset(entry))
		.map((entry) => compiler(entry))
		.filter((entry): entry is Dataset => entry !== undefined);

	if (compiled.length === 0) {
		return undefined;
	}

	return compiled.length === 1 ? compiled[0] : compiled;
}

function compilePatientFilter(input: Dataset): Dataset | undefined {
	const compiled: Dataset = {};

	for (const [key, value] of Object.entries(input)) {
		switch (key) {
			case 'age':
				compiled.age = value;
				break;
			case 'ageGroup':
				compiled.age = mergeAgeGroup(compiled.age, value);
				break;
			case 'samePerson':
				compiled.samePerson = value;
				break;
			default:
				compiled[key] = value;
				break;
		}
	}

	return Object.keys(compiled).length > 0 ? compiled : undefined;
}

function compileEncounterFilter(input: Dataset): Dataset | undefined {
	const compiled: Dataset = {};

	for (const [key, value] of Object.entries(input)) {
		switch (key) {
			case 'class':
				compiled.class = normalizeEncounterClass(value);
				break;
			case 'stayDays':
				compiled.stayDays = value;
				break;
			case 'count':
				break;
			default:
				compiled[key] = value;
				break;
		}
	}

	return Object.keys(compiled).length > 0 ? compiled : undefined;
}

function compileConditionFilter(input: Dataset): Dataset | undefined {
	return Object.keys(input).length > 0 ? { ...input } : undefined;
}

function compileAllergyFilter(input: Dataset): Dataset | undefined {
	return Object.keys(input).length > 0 ? { ...input } : undefined;
}

function compileObservationFilter(input: Dataset): Dataset | undefined {
	return Object.keys(input).length > 0 ? { ...input } : undefined;
}

function compileProcedureFilter(input: Dataset): Dataset | undefined {
	return Object.keys(input).length > 0 ? { ...input } : undefined;
}

function compileGenericResourceFilter(input: Dataset): Dataset | undefined {
	return Object.keys(input).length > 0 ? { ...input } : undefined;
}

function mergeAgeGroup(current: unknown, ageGroup: unknown): unknown {
	if (typeof ageGroup !== 'string') {
		return current;
	}

	const normalized =
		ageGroup === 'child'
			? { lt: 12 }
			: ageGroup === 'adult'
				? { gte: 18 }
				: ageGroup === 'elderly'
					? { gte: 65 }
					: undefined;

	if (!normalized) {
		return current;
	}

	return isDataset(current) ? { ...normalized, ...current } : normalized;
}

function normalizeEncounterClass(value: unknown): unknown {
	if (value === 'ambulatory') {
		return 'AMB';
	}

	if (value === 'emergency') {
		return 'EMER';
	}

	if (value === 'inpatient') {
		return 'IMP';
	}

	return value;
}

function getScenarioDisplayName(document: ScenarioDocument): string {
	return document.name ?? '';
}

function getScenarioSummary(document: ScenarioDocument): string | undefined {
	return document.summary;
}

function getScenarioLevel(document: ScenarioDocument): ScenarioLevel | undefined {
	const { level } = document;

	return typeof level === 'number' && Number.isInteger(level) ? level : undefined;
}

function isDataset(value: unknown): value is Dataset {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertScenarioMetadata(document: ScenarioDocument): void {
	for (const issue of validateScenarioDocument(document)) {
		if (issue.severity === 'error') {
			throw new Error(`${issue.message}${issue.path.length > 0 ? ` (${issue.path})` : ''}`);
		}
	}

	if (typeof document.id !== 'string' || document.id.length === 0) {
		throw new Error('Scenario metadata field "id" must be a non-empty string.');
	}

	if (typeof document.name !== 'string' || document.name.length === 0) {
		throw new Error('Scenario metadata field "name" must be a non-empty string.');
	}

	if (typeof document.type !== 'string' || document.type.length === 0) {
		throw new Error('Scenario metadata field "type" must be a non-empty string.');
	}

	if (document.summary !== undefined && typeof document.summary !== 'string') {
		throw new Error('Scenario metadata field "summary" must be a string when provided.');
	}

	if (document.details !== undefined && typeof document.details !== 'string') {
		throw new Error('Scenario metadata field "details" must be a string when provided.');
	}

	if (document.level !== undefined && getScenarioLevel(document) === undefined) {
		throw new Error('Scenario metadata field "level" must be an integer when provided.');
	}

	if (document.selection !== undefined && !isDataset(document.selection)) {
		throw new Error('Scenario metadata field "selection" must be an object when provided.');
	}
}
