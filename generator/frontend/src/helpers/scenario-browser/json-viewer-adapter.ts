import { getFieldPath, getSourceFieldDoc, getSourceFieldPathPrefix } from '../../lib/source-json-docs.js';
import { formatSourceResourceType } from '../../lib/source-resource-display.js';
import { isLowReadabilityIdentifier } from '../../lib/resource-preview.js';

import type {
	JsonViewerAnnotation,
	JsonViewerExtensions,
	JsonViewerNodeContext,
} from '../../components/json-viewer/types.js';
import type { SourceCodeDisplayMap, SourceFieldDocRecord } from '../../types.js';

interface ScenarioBrowserJsonViewerAdapterOptions {
	sourceFieldDocs: Record<string, SourceFieldDocRecord>;
	sourceCodeDisplayMap: SourceCodeDisplayMap;
	docsEnabled: boolean;
	showCodeDisplayValues: boolean;
	onSourceResourceSelect?: (sourceKey: string) => void;
	pathPrefix?: string;
	fullUrlResourceTypes?: Map<string, string>;
}

export function createScenarioBrowserJsonViewerExtensions(
	options: ScenarioBrowserJsonViewerAdapterOptions,
): JsonViewerExtensions {
	return {
		resolveFieldDoc: (ctx) => getFieldDoc(ctx, options),
		resolveAnnotations: (ctx) => getAnnotations(ctx, options),
		onAnnotationClick: (annotation) => {
			if (!annotation.key?.startsWith('source-link:')) {
				return;
			}

			const sourceKey = annotation.key.slice('source-link:'.length);
			options.onSourceResourceSelect?.(sourceKey);
		},
	};
}

interface ScenarioBrowserJsonViewerExtensionsForValueOptions extends Omit<
	ScenarioBrowserJsonViewerAdapterOptions,
	'pathPrefix'
> {
	value: unknown;
}

export function createScenarioBrowserJsonViewerExtensionsForValue(
	options: ScenarioBrowserJsonViewerExtensionsForValueOptions,
): JsonViewerExtensions {
	return createScenarioBrowserJsonViewerExtensions({
		...options,
		pathPrefix: options.docsEnabled ? getSourceFieldPathPrefix(options.value) : undefined,
		fullUrlResourceTypes: buildFullUrlResourceTypeMap(options.value),
	});
}

function getFieldDoc(
	ctx: JsonViewerNodeContext,
	options: Pick<ScenarioBrowserJsonViewerAdapterOptions, 'sourceFieldDocs' | 'docsEnabled' | 'pathPrefix'>,
) {
	if (!options.docsEnabled || typeof ctx.keyName !== 'string') {
		return null;
	}

	const path = getFieldPath(ctx.keys, ctx.keyName, options.pathPrefix);
	const doc = getSourceFieldDoc(options.sourceFieldDocs, path, ctx.keyName);

	if (!doc) {
		return null;
	}

	const fhirMapping = readMostRelevantFhirMapping(doc.fhirMapping, path);
	const metadata = [
		fhirMapping ? { label: 'FHIR', value: fhirMapping } : null,
		typeof doc.required === 'boolean' ? { label: '必填', value: doc.required ? '是' : '否' } : null,
	].filter((entry): entry is { label: string; value: string } => entry !== null);

	return {
		description: doc.description ?? '',
		metadata,
	};
}

function readMostRelevantFhirMapping(fhirMapping: string | undefined, currentPath: string): string | undefined {
	const mappings = fhirMapping
		?.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);

	if (!mappings || mappings.length === 0) {
		return undefined;
	}

	const normalizedCurrentPath = normalizeDocPath(currentPath);
	return mappings.find((mapping) => normalizeDocPath(mapping) === normalizedCurrentPath) ?? mappings[0];
}

function normalizeDocPath(path: string): string {
	const [resourceType, ...segments] = path.split('.');
	const normalizedSegments = segments.map((segment) => segment.replace(/\[\d+\]/gu, '').replace(/:.+$/u, ''));
	return [resourceType?.toLowerCase(), ...normalizedSegments].filter(Boolean).join('.');
}

function getAnnotations(
	ctx: JsonViewerNodeContext,
	options: ScenarioBrowserJsonViewerAdapterOptions,
): JsonViewerAnnotation[] | null {
	const annotations: JsonViewerAnnotation[] = [];

	const displayValue = options.showCodeDisplayValues
		? getCodeDisplayValue(
				ctx.keyName,
				ctx.keys,
				ctx.value,
				ctx.parentValue,
				options.pathPrefix,
				options.sourceCodeDisplayMap,
			)
		: undefined;

	if (displayValue) {
		annotations.push({
			type: 'text',
			text: displayValue,
			title: displayValue,
			key: `display:${displayValue}`,
		});
	}

	const sourceResourceKey = getSourceResourceLinkTarget(
		ctx.keyName,
		ctx.keys,
		ctx.value,
		ctx.parentValue,
		options.pathPrefix,
		options.sourceFieldDocs,
	);

	if (!sourceResourceKey) {
		const fhirReferenceResourceType = getFhirReferenceResourceType(
			ctx.keyName,
			ctx.value,
			options.fullUrlResourceTypes,
		);
		if (!fhirReferenceResourceType) {
			return annotations.length > 0 ? annotations : null;
		}

		annotations.push({
			type: 'text',
			text: formatSourceResourceType(fhirReferenceResourceType),
			title: fhirReferenceResourceType,
			key: `fhir-reference:${fhirReferenceResourceType}:${String(ctx.value)}`,
		});

		return annotations;
	}

	if (options.onSourceResourceSelect) {
		annotations.push({
			type: 'button',
			label: formatSourceResourceKeyAnnotation(sourceResourceKey),
			title: `查看 ${sourceResourceKey}`,
			key: `source-link:${sourceResourceKey}`,
		});

		return annotations;
	}

	annotations.push({
		type: 'text',
		text: formatSourceResourceKeyAnnotation(sourceResourceKey),
		title: sourceResourceKey,
		key: `source-link:${sourceResourceKey}`,
	});

	return annotations;
}

function getFhirReferenceResourceType(
	keyName: string | number | undefined,
	value: unknown,
	fullUrlResourceTypes: Map<string, string> | undefined,
): string | undefined {
	if (keyName !== 'reference' || typeof value !== 'string' || value.length === 0) {
		return undefined;
	}

	return fullUrlResourceTypes?.get(value);
}

function buildFullUrlResourceTypeMap(value: unknown): Map<string, string> | undefined {
	if (!isJsonObject(value) || value.resourceType !== 'Bundle' || !Array.isArray(value.entry)) {
		return undefined;
	}

	const map = new Map<string, string>();

	for (const entry of value.entry) {
		if (!isJsonObject(entry) || typeof entry.fullUrl !== 'string' || !isJsonObject(entry.resource)) {
			continue;
		}

		const resourceType = entry.resource.resourceType;
		if (typeof resourceType === 'string' && resourceType.length > 0) {
			map.set(entry.fullUrl, resourceType);
		}
	}

	return map.size > 0 ? map : undefined;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

export function getCodeDisplayValue(
	keyName: string | number | undefined,
	keys: Array<string | number> | undefined,
	value: unknown,
	parentValue: unknown,
	pathPrefix: string | undefined,
	sourceCodeDisplayMap: SourceCodeDisplayMap,
): string | undefined {
	if (typeof keyName !== 'string') {
		return undefined;
	}

	if (keyName === 'code' && isJsonObject(parentValue)) {
		const displayValue = parentValue.display;

		if (typeof displayValue === 'string' && displayValue.length > 0) {
			return displayValue;
		}
	}

	if (typeof value !== 'string' || value.length === 0) {
		return undefined;
	}

	const fieldPath = getFieldPath(keys, keyName, pathPrefix);
	return sourceCodeDisplayMap[`${fieldPath}:${value}`];
}

export function getSourceResourceLinkTarget(
	keyName: string | number | undefined,
	keys: Array<string | number> | undefined,
	value: unknown,
	parentValue: unknown,
	pathPrefix?: string,
	sourceFieldDocs: Record<string, SourceFieldDocRecord> = {},
): string | undefined {
	if (typeof keyName !== 'string' || typeof value !== 'string' || value.length === 0) {
		return undefined;
	}

	const fieldPath = getFieldPath(keys, keyName, pathPrefix);
	const doc = getSourceFieldDoc(sourceFieldDocs, fieldPath, keyName);

	if (!doc?.reference) {
		return undefined;
	}

	if (Array.isArray(doc.reference)) {
		const resolvedReference = resolvePolymorphicReferenceType(keyName, parentValue, doc.reference);
		return resolvedReference ? `${resolvedReference}/${value}` : undefined;
	}

	return `${doc.reference.toLowerCase()}/${value}`;
}

function resolvePolymorphicReferenceType(
	keyName: string,
	parentValue: unknown,
	candidates: string[],
): string | undefined {
	if (!isJsonObject(parentValue)) {
		return undefined;
	}

	const typeFieldName = keyName.endsWith('Id') ? `${keyName.slice(0, -2)}Type` : `${keyName}Type`;
	const rawTypeValue = parentValue[typeFieldName];

	if (typeof rawTypeValue !== 'string' || rawTypeValue.length === 0) {
		return undefined;
	}

	const normalizedTypeValue = rawTypeValue.toLowerCase();
	const resolvedCandidate = candidates.find((candidate) => candidate.toLowerCase() === normalizedTypeValue);

	return resolvedCandidate?.toLowerCase();
}

function formatSourceResourceKeyAnnotation(sourceKey: string): string {
	const [resourceType, resourceId] = sourceKey.split('/');

	if (!resourceType || !resourceId) {
		return sourceKey;
	}

	if (isLowReadabilityIdentifier(resourceId)) {
		return formatSourceResourceType(resourceType);
	}

	return `${formatSourceResourceType(resourceType)}/${resourceId}`;
}
