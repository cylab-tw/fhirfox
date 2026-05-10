import { getFieldPath, getSourceFieldDoc, getSourceFieldPathPrefix } from '../../lib/source-json-docs.js';
import { formatSourceResourceType } from '../../lib/source-resource-display.js';

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

	const metadata = [
		doc.fhirMapping ? { label: 'FHIR', value: doc.fhirMapping } : null,
		{ label: 'Cardinality', value: doc.cardinality },
	].filter((entry): entry is { label: string; value: string } => entry !== null);

	return {
		description: doc.description ?? '',
		metadata,
	};
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
		return annotations.length > 0 ? annotations : null;
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

	return `${formatSourceResourceType(resourceType)}/${resourceId}`;
}
