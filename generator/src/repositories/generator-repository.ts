import type { CodeMapping, GeneratorRule, ResourceProfile, SourceRecord, SourceRow } from '../generator/types.js';
import {
	SourceSchemaMetadata,
	inferBaseTable,
	quoteIdentifier,
	quoteQualifiedTableName,
} from './source-schema-metadata.js';
import type { Pool } from 'pg';
import { getPool } from '../db/pool.js';

function toGeneratorRule(row: Record<string, unknown>): GeneratorRule {
	return {
		igName: String(row.ig_name),
		igVersion: String(row.ig_version),
		resourceType: String(row.resource_type),
		sourceTable: String(row.source_table),
		sourceColumn: String(row.source_column),
		fhirPath: String(row.fhir_path),
		dataType: String(row.data_type),
		isRequired: Boolean(row.is_required),
		transformKind: row.transform_kind as GeneratorRule['transformKind'],
		mappingKey: row.mapping_key === null ? null : String(row.mapping_key),
		referenceTarget: row.reference_target === null ? null : String(row.reference_target),
		sortOrder: Number(row.sort_order),
	};
}

function toResourceProfile(row: Record<string, unknown>): ResourceProfile {
	return {
		igName: String(row.ig_name),
		igVersion: String(row.ig_version),
		resourceType: String(row.resource_type),
		profileUrl: String(row.profile_url),
	};
}

function toCodeMapping(row: Record<string, unknown>): CodeMapping {
	return {
		mappingKey: String(row.mapping_key),
		sourceCode: String(row.source_code),
		targetCode: String(row.target_code),
		targetDisplay: row.target_display === null ? null : String(row.target_display),
		targetSystem: String(row.target_system),
		displayZhTw: row.display_zh_tw === null ? null : String(row.display_zh_tw),
		groupName: row.group_name === null ? null : String(row.group_name),
	};
}

function normalizeValue(value: unknown): string | boolean | undefined {
	if (value === null || value === undefined) {
		return undefined;
	}

	if (typeof value === 'boolean' || typeof value === 'string') {
		return value;
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	return String(value);
}

function toSourceRow(row: Record<string, unknown>): SourceRow {
	return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalizeValue(value)]));
}

export class GeneratorRepository {
	private readonly pool: Pool;

	private readonly sourceSchemaMetadata: SourceSchemaMetadata;

	constructor(pool: Pool = getPool()) {
		this.pool = pool;
		this.sourceSchemaMetadata = new SourceSchemaMetadata(pool);
	}

	async getRules(params: { igName: string; igVersion: string; resourceType: string }): Promise<GeneratorRule[]> {
		const result = await this.pool.query<Record<string, unknown>>(
			`
				SELECT
					ig_name,
					ig_version,
					resource_type,
					source_table,
					source_column,
					fhir_path,
					data_type,
					is_required,
					transform_kind,
					mapping_key,
					reference_target,
					sort_order
				FROM fhirfox.generator_rule
				WHERE ig_name = $1
					AND ig_version = $2
					AND resource_type = $3
					AND is_active = TRUE
				ORDER BY sort_order ASC
			`,
			[params.igName, params.igVersion, params.resourceType],
		);

		return result.rows.map(toGeneratorRule);
	}

	async getResourceProfile(params: {
		igName: string;
		igVersion: string;
		resourceType: string;
	}): Promise<ResourceProfile | null> {
		const result = await this.pool.query<Record<string, unknown>>(
			`
				SELECT
					ig_name,
					ig_version,
					resource_type,
					profile_url
				FROM fhirfox.resource_profile
				WHERE ig_name = $1
					AND ig_version = $2
					AND resource_type = $3
					AND is_active = TRUE
			`,
			[params.igName, params.igVersion, params.resourceType],
		);

		if (result.rows.length === 0) {
			return null;
		}

		return toResourceProfile(result.rows[0]);
	}

	async getMappings(mappingKeys: string[]): Promise<CodeMapping[]> {
		if (mappingKeys.length === 0) {
			return [];
		}

		const result = await this.pool.query<Record<string, unknown>>(
			`
				SELECT
					mapping_key,
					source_code,
					target_code,
					target_display,
					target_system,
					display_zh_tw,
					group_name
				FROM fhirfox.code_mapping
				WHERE is_active = TRUE
					AND mapping_key = ANY($1::text[])
				ORDER BY mapping_key ASC, source_code ASC
			`,
			[mappingKeys],
		);

		return result.rows.map(toCodeMapping);
	}

	async getSourceRecord(params: {
		resourceType: string;
		id: string;
		sourceTables: string[];
	}): Promise<SourceRecord | null> {
		const tables = [...new Set(params.sourceTables)];
		const baseTable = inferBaseTable(tables);
		const baseTableIdColumn = await this.sourceSchemaMetadata.getPrimaryKeyColumn(baseTable);

		const rootQuery = `
			SELECT *
			FROM ${quoteQualifiedTableName(baseTable)}
			WHERE ${quoteIdentifier(baseTableIdColumn)} = $1
		`;
		const root = await this.pool.query<Record<string, unknown>>(rootQuery, [params.id]);

		if (root.rows.length === 0) {
			return null;
		}

		const recordTables = Object.fromEntries(
			await Promise.all(
				tables.map(async (tableName) => {
					const filterColumn = await this.sourceSchemaMetadata.getFilterColumn(tableName, baseTable);
					const orderBy = await this.sourceSchemaMetadata.getOrderByColumns(tableName, filterColumn);
					const query = `
						SELECT *
						FROM ${quoteQualifiedTableName(tableName)}
						WHERE ${quoteIdentifier(filterColumn)} = $1
						ORDER BY ${orderBy.map(quoteIdentifier).join(', ')}
					`;
					const result = await this.pool.query<Record<string, unknown>>(query, [params.id]);

					return [tableName, result.rows.map(toSourceRow)] as const;
				}),
			),
		) as Record<string, SourceRow[]>;

		return {
			resourceType: params.resourceType,
			logicalId: params.id,
			tables: recordTables,
		};
	}
}
