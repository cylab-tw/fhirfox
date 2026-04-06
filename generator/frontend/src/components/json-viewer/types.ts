import type { SymbolsElementResult } from '@uiw/react-json-view';

/** Context for a value/key currently being rendered in the JSON tree. */
export type JsonViewerNodeContext = SymbolsElementResult<object>;

/** Generic metadata row shown in tooltips. */
export interface JsonViewerMetaItem {
	/** Row label, e.g. "Cardinality". */
	label: string;
	/** Row value, e.g. "0..1". */
	value: string;
}

/** Generic field doc resolved by host app/domain. */
export interface JsonViewerFieldDoc {
	/** Short human-readable description. */
	description: string;
	/** Optional metadata rows from any domain/data source. */
	metadata?: JsonViewerMetaItem[];
}

/** Base annotation rendered next to a row. */
interface JsonViewerAnnotationBase {
	/** Optional stable key for rendering lists. */
	key?: string;
	/** Optional title tooltip. */
	title?: string;
}

/** Clickable annotation rendered inline. */
export interface JsonViewerButtonAnnotation extends JsonViewerAnnotationBase {
	type: 'button';
	label: string;
}

/** Plain text annotation rendered inline. */
export interface JsonViewerTextAnnotation extends JsonViewerAnnotationBase {
	type: 'text';
	text: string;
}

/** Inline row annotation. */
export type JsonViewerAnnotation = JsonViewerButtonAnnotation | JsonViewerTextAnnotation;

/** Extension points injected by host domain. */
export interface JsonViewerExtensions {
	/** Resolve field doc for tooltip; return null when unavailable. */
	resolveFieldDoc?: (ctx: JsonViewerNodeContext) => JsonViewerFieldDoc | null;
	/** Resolve inline annotations rendered after row value. */
	resolveAnnotations?: (ctx: JsonViewerNodeContext) => JsonViewerAnnotation[] | null;
	/** Handle clickable annotation action in host domain. */
	onAnnotationClick?: (annotation: JsonViewerButtonAnnotation, ctx: JsonViewerNodeContext) => void;
}

/** Internal tooltip state. */
export interface JsonViewerTooltipState {
	/** Screen X coordinate. */
	x: number;
	/** Screen Y coordinate. */
	y: number;
	/** Tooltip doc content. */
	doc: JsonViewerFieldDoc;
}

/** Row text snapshot used for multi-line copy handling. */
export interface RenderedJsonLine {
	/** Source element for this line. */
	element: HTMLElement;
	/** Rendered plain text content. */
	text: string;
}

/** Source-to-rendered line mapping index. */
export interface SourceLineIndex {
	/** Number of lines in source JSON string. */
	lineCount: number;
	/** Matching close-bracket line for each open-bracket line. */
	matchingCloseLine: number[];
}
