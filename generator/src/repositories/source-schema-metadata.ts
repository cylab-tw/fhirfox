import type { Pool } from 'pg';

function splitQualifiedTableName(tableName: string): {
	schemaName: string;
	localName: string;
} {
	const [schemaName, localName] = tableName.split('.');

	if (!schemaName || !localName) {
		throw new Error(`Expected a schema-qualified table name, received "${tableName}"`);
	}

	return { schemaName, localName };
}

export function inferBaseTable(sourceTables: string[]): string {
	const tables = [...new Set(sourceTables)];

	if (tables.length === 0) {
		throw new Error('Cannot infer a base table without source tables');
	}

	const sortedTables = [...tables].sort((left, right) => left.length - right.length);
	const baseTable = sortedTables.find((candidate) =>
		tables.every((tableName) => tableName === candidate || tableName.startsWith(`${candidate}_`)),
	);

	if (!baseTable) {
		throw new Error(`Could not infer a base table from source tables: ${tables.join(', ')}`);
	}

	return baseTable;
}

export function quoteIdentifier(identifier: string): string {
	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
		throw new Error(`Unsafe SQL identifier: ${identifier}`);
	}

	return `"${identifier}"`;
}

export function quoteQualifiedTableName(tableName: string): string {
	const { schemaName, localName } = splitQualifiedTableName(tableName);

	return `${quoteIdentifier(schemaName)}.${quoteIdentifier(localName)}`;
}

async function getSingleColumnName(
	pool: Pool,
	query: string,
	params: string[],
	missingMessage: string,
	multipleMessage: string,
): Promise<string> {
	const result = await pool.query<{ column_name: string }>(query, params);

	if (result.rows.length === 0) {
		throw new Error(missingMessage);
	}

	if (result.rows.length > 1) {
		throw new Error(multipleMessage);
	}

	return result.rows[0].column_name;
}

export class SourceSchemaMetadata {
	private readonly primaryKeyColumnCache = new Map<string, Promise<string>>();

	private readonly foreignKeyColumnCache = new Map<string, Promise<string>>();

	private readonly columnExistsCache = new Map<string, Promise<boolean>>();

	constructor(private readonly pool: Pool) {}

	getPrimaryKeyColumn(tableName: string): Promise<string> {
		const cached = this.primaryKeyColumnCache.get(tableName);
		if (cached) {
			return cached;
		}

		const { schemaName, localName } = splitQualifiedTableName(tableName);
		const query = `
			SELECT kcu.column_name
			FROM information_schema.table_constraints tc
			JOIN information_schema.key_column_usage kcu
				ON tc.constraint_name = kcu.constraint_name
				AND tc.table_schema = kcu.table_schema
				AND tc.table_name = kcu.table_name
			WHERE tc.constraint_type = 'PRIMARY KEY'
				AND tc.table_schema = $1
				AND tc.table_name = $2
			ORDER BY kcu.ordinal_position
		`;

		const promise = getSingleColumnName(
			this.pool,
			query,
			[schemaName, localName],
			`Table ${tableName} does not have a primary key column`,
			`Table ${tableName} has a composite primary key, which is not supported`,
		);

		this.primaryKeyColumnCache.set(tableName, promise);
		return promise;
	}

	getForeignKeyColumn(tableName: string, referencedTableName: string): Promise<string> {
		const cacheKey = `${tableName}->${referencedTableName}`;
		const cached = this.foreignKeyColumnCache.get(cacheKey);
		if (cached) {
			return cached;
		}

		const { schemaName, localName } = splitQualifiedTableName(tableName);
		const referenced = splitQualifiedTableName(referencedTableName);
		const query = `
			SELECT kcu.column_name
			FROM information_schema.table_constraints tc
			JOIN information_schema.key_column_usage kcu
				ON tc.constraint_name = kcu.constraint_name
				AND tc.table_schema = kcu.table_schema
				AND tc.table_name = kcu.table_name
			JOIN information_schema.constraint_column_usage ccu
				ON tc.constraint_name = ccu.constraint_name
				AND tc.table_schema = ccu.table_schema
			WHERE tc.constraint_type = 'FOREIGN KEY'
				AND tc.table_schema = $1
				AND tc.table_name = $2
				AND ccu.table_schema = $3
				AND ccu.table_name = $4
			ORDER BY kcu.ordinal_position
		`;

		const promise = getSingleColumnName(
			this.pool,
			query,
			[schemaName, localName, referenced.schemaName, referenced.localName],
			`Table ${tableName} does not have a foreign key to ${referencedTableName}`,
			`Table ${tableName} has multiple foreign key columns to ${referencedTableName}, which is not supported`,
		);

		this.foreignKeyColumnCache.set(cacheKey, promise);
		return promise;
	}

	hasColumn(tableName: string, columnName: string): Promise<boolean> {
		const cacheKey = `${tableName}.${columnName}`;
		const cached = this.columnExistsCache.get(cacheKey);
		if (cached) {
			return cached;
		}

		const { schemaName, localName } = splitQualifiedTableName(tableName);
		const promise = this.pool
			.query<{ exists: boolean }>(
				`
					SELECT EXISTS (
						SELECT 1
						FROM information_schema.columns
						WHERE table_schema = $1
							AND table_name = $2
							AND column_name = $3
					) AS exists
				`,
				[schemaName, localName, columnName],
			)
			.then((result) => result.rows[0]?.exists ?? false);

		this.columnExistsCache.set(cacheKey, promise);
		return promise;
	}

	async getFilterColumn(tableName: string, baseTable: string): Promise<string> {
		if (tableName === baseTable) {
			return this.getPrimaryKeyColumn(tableName);
		}

		return this.getForeignKeyColumn(tableName, baseTable);
	}

	async getOrderByColumns(tableName: string, filterColumn: string): Promise<string[]> {
		const [primaryKeyColumn, hasSortOrder] = await Promise.all([
			this.getPrimaryKeyColumn(tableName),
			this.hasColumn(tableName, 'sort_order'),
		]);

		return [...new Set(hasSortOrder ? ['sort_order', primaryKeyColumn] : [primaryKeyColumn, filterColumn])];
	}
}
