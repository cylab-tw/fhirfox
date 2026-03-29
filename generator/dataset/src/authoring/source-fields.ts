import type { SourceAuthoringSchema, SourceFieldDocRecord, SourceResourceModel } from './contracts.js';
import type { ResourceLink } from '../resources/index.js';

type RawDocument = Record<string, unknown>;

export function buildSourceAuthoringSchema(documents: RawDocument[]): SourceAuthoringSchema {
	const models = Object.fromEntries(
		documents.flatMap((document) => {
			const model = parseSourceFieldDocument(document);
			return model ? [[model.resourceType, model]] : [];
		}),
	);

	const docs: Record<string, SourceFieldDocRecord> = {};
	const order: Record<string, string[]> = {};

	for (const model of Object.values(models)) {
		docs[model.resourceType] = {
			description: model.description,
			cardinality: model.cardinality,
			required: false,
		};
		order[model.resourceType] = [...model.order];

		for (const [field, definition] of Object.entries(model.fields)) {
			docs[`${model.resourceType}.${field}`] = definition;
		}
	}

	return { models, docs, order };
}

export function parseSourceFieldDocument(document: RawDocument): SourceResourceModel | null {
	const [resourceType, rawValue] = Object.entries(document)[0] ?? [];

	if (!resourceType || !isRecord(rawValue)) {
		return null;
	}

	const description = readString(rawValue.description) ?? '';
	const cardinality = readString(rawValue.cardinality) ?? '0..*';
	const fieldEntries = Object.entries(rawValue).filter((entry) => isRecord(entry[1]) && entry[0] !== 'fields');
	const fields: Record<string, SourceFieldDocRecord> = {};
	const order: string[] = [];

	for (const [key, value] of fieldEntries) {
		if (key === 'label' || key === 'description' || key === 'cardinality') {
			continue;
		}

		if (!isRecord(value)) {
			continue;
		}

		order.push(key);
		fields[key] = {
			description: readString(value.description) ?? '',
			cardinality: readString(value.cardinality) ?? '0..1',
			required: readBoolean(value.required) ?? isRequiredCardinality(readString(value.cardinality)),
			fhirMapping: readString(value.fhirMapping),
			reference: readReference(value.reference),
		};
	}

	return {
		resourceType: resourceType.toLowerCase(),
		description,
		cardinality,
		fields,
		order,
	};
}

export function deriveResourceLinks(schema: SourceAuthoringSchema): ResourceLink[] {
	const links: ResourceLink[] = [];

	for (const model of Object.values(schema.models)) {
		for (const [field, definition] of Object.entries(model.fields)) {
			const targetTypes = readReferenceTypes(definition.reference);

			if (targetTypes.length === 0) {
				continue;
			}

			links.push({
				sourceType: model.resourceType,
				field,
				targetTypes,
			});
		}
	}

	return links;
}

function isRequiredCardinality(cardinality: string | undefined): boolean {
	return typeof cardinality === 'string' && cardinality.startsWith('1..');
}

function readString(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
	return typeof value === 'boolean' ? value : undefined;
}

function readReference(value: unknown): string | string[] | undefined {
	const single = readString(value);

	if (single) {
		return single;
	}

	if (Array.isArray(value)) {
		const references = value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
		return references.length > 0 ? references : undefined;
	}

	return undefined;
}

function readReferenceTypes(value: string | string[] | undefined): string[] {
	if (!value) {
		return [];
	}

	return Array.isArray(value) ? value : [value];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
