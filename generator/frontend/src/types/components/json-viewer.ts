/** Context for a value/key currently being rendered in the JSON tree. */
export interface JsonViewerNodeContext {
	/** Current key name or array index. */
	keyName: string | number | undefined;
	/** Full key path reported by the renderer. */
	keys: Array<string | number> | undefined;
	/** Current node value. */
	value: unknown;
	/** Parent node value. */
	parentValue: unknown;
	/** Root JSON value. */
	rootValue: unknown;
}

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

/** Link annotation rendered next to a row. */
export interface JsonViewerLink {
	/** Opaque link payload interpreted by host app. */
	target: string;
	/** Optional visible label. */
	label?: string;
	/** Optional title tooltip. */
	title?: string;
}

/** Extension points injected by host domain. */
export interface JsonViewerExtensions {
	/** Resolve field doc for tooltip; return null when unavailable. */
	resolveFieldDoc?: (ctx: JsonViewerNodeContext) => JsonViewerFieldDoc | null;
	/** Resolve plain annotation text rendered after row value. */
	resolveAnnotation?: (ctx: JsonViewerNodeContext) => string | null;
	/** Resolve optional link annotation rendered after row value. */
	resolveLink?: (ctx: JsonViewerNodeContext) => JsonViewerLink | null;
	/** Handle link click in host domain. */
	onLinkClick?: (link: JsonViewerLink, ctx: JsonViewerNodeContext) => void;
}

/** Props for generic JSON viewer. */
export interface JsonViewerProps<T = unknown> {
	/** Optional CSS overrides for root container. */
	className?: string;
	/** Optional extension resolvers from host domain. */
	extensions?: JsonViewerExtensions;
	/** Any JSON-like value. */
	value: T;
}
