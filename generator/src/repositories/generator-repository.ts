import type { CodeMapping, GeneratorRule, ResourceProfile, SourceRecord, SourceRow } from '../generator/types.js';
import type { ScenarioPredicate, ScenarioQueryPlan, ScenarioSort, ScenarioValue } from '../scenarios/types.js';
import {
	SourceSchemaMetadata,
	inferBaseTable,
	quoteIdentifier,
	quoteQualifiedTableName,
} from './source-schema-metadata.js';
import type { Pool } from 'pg';
import { getPool } from '../db/pool.js';

interface ResourceFieldMetadata {
	column: string;
	dataType: string;
}

interface ResourceRelationMetadata {
	sourceResourceType: string;
	targetResourceType: string;
	sourceTable: string;
	sourceIdColumn: string;
	sourceReferenceColumn: string;
	targetTable: string;
	targetIdColumn: string;
}

interface ResourceCatalogEntry {
	resourceType: string;
	baseTable: string;
	idColumn: string;
	fieldMap: Map<string, ResourceFieldMetadata>;
	relations: ResourceRelationMetadata[];
}

interface RelationTraversalStep {
	direction: 'forward' | 'backward';
	relation: ResourceRelationMetadata;
	nextResourceType: string;
}

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

function normalizeLookupKey(value: string): string {
	return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function getRelativeFhirPath(rule: GeneratorRule): string {
	const prefix = `${rule.resourceType}.`;

	return rule.fhirPath.startsWith(prefix) ? rule.fhirPath.slice(prefix.length) : rule.fhirPath;
}

function deriveFieldAliases(rule: GeneratorRule): string[] {
	const relativePath = getRelativeFhirPath(rule);
	const [firstSegment] = relativePath.split('.');
	const normalizedSegment = firstSegment.split(':')[0].replace(/\[(\d*)\]/g, '');

	return [...new Set([rule.sourceColumn, normalizedSegment])];
}

function addYears(date: Date, years: number): Date {
	const next = new Date(date);
	next.setUTCFullYear(next.getUTCFullYear() + years);
	return next;
}

function addDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setUTCDate(next.getUTCDate() + days);
	return next;
}

function buildAgeBoundary(operator: ScenarioPredicate['operator'], value: ScenarioValue): string {
	if (typeof value !== 'number') {
		throw new Error('Age predicates require a numeric value');
	}

	const today = new Date();
	today.setUTCHours(0, 0, 0, 0);

	if (operator === 'gte') {
		return addYears(today, -value).toISOString().slice(0, 10);
	}

	if (operator === 'lte') {
		return addDays(addYears(today, -(value + 1)), 1)
			.toISOString()
			.slice(0, 10);
	}

	throw new Error('Age predicates only support min/max constraints');
}

export class GeneratorRepository {
	private readonly pool: Pool;

	private readonly sourceSchemaMetadata: SourceSchemaMetadata;

	constructor(pool: Pool = getPool()) {
		this.pool = pool;
		this.sourceSchemaMetadata = new SourceSchemaMetadata(pool);
	}

	async getAllRules(params: { igName: string; igVersion: string }): Promise<GeneratorRule[]> {
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
					AND is_active = TRUE
				ORDER BY resource_type ASC, sort_order ASC
			`,
			[params.igName, params.igVersion],
		);

		return result.rows.map(toGeneratorRule);
	}

	async getRules(params: { igName: string; igVersion: string; resourceType: string }): Promise<GeneratorRule[]> {
		const rules = await this.getAllRules({
			igName: params.igName,
			igVersion: params.igVersion,
		});

		return rules.filter((rule) => rule.resourceType === params.resourceType);
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

	private async buildResourceCatalog(params: {
		igName: string;
		igVersion: string;
	}): Promise<Map<string, ResourceCatalogEntry>> {
		const rules = await this.getAllRules(params);
		const rulesByResourceType = new Map<string, GeneratorRule[]>();

		for (const rule of rules) {
			const group = rulesByResourceType.get(rule.resourceType) ?? [];
			group.push(rule);
			rulesByResourceType.set(rule.resourceType, group);
		}

		const baseEntries = await Promise.all(
			[...rulesByResourceType.entries()].map(async ([resourceType, resourceRules]) => {
				const baseTable = inferBaseTable(resourceRules.map((rule) => rule.sourceTable));
				const idColumn = await this.sourceSchemaMetadata.getPrimaryKeyColumn(baseTable);
				const fieldMap = new Map<string, ResourceFieldMetadata>();

				for (const rule of resourceRules) {
					if (rule.sourceTable !== baseTable) {
						continue;
					}

					for (const alias of deriveFieldAliases(rule)) {
						const lookupKey = normalizeLookupKey(alias);
						if (!fieldMap.has(lookupKey)) {
							fieldMap.set(lookupKey, {
								column: rule.sourceColumn,
								dataType: rule.dataType,
							});
						}
					}
				}

				return [
					resourceType,
					{
						resourceType,
						baseTable,
						idColumn,
						fieldMap,
						relations: [] as ResourceRelationMetadata[],
					},
				] as const;
			}),
		);

		const catalog = new Map<string, ResourceCatalogEntry>(baseEntries);

		for (const [resourceType, resourceRules] of rulesByResourceType.entries()) {
			const entry = catalog.get(resourceType);
			if (!entry) {
				continue;
			}

			for (const rule of resourceRules) {
				if (rule.transformKind !== 'build_reference' || rule.sourceTable !== entry.baseTable || !rule.referenceTarget) {
					continue;
				}

				const targetEntry = catalog.get(rule.referenceTarget);
				if (!targetEntry) {
					continue;
				}

				entry.relations.push({
					sourceResourceType: resourceType,
					targetResourceType: rule.referenceTarget,
					sourceTable: entry.baseTable,
					sourceIdColumn: entry.idColumn,
					sourceReferenceColumn: rule.sourceColumn,
					targetTable: targetEntry.baseTable,
					targetIdColumn: targetEntry.idColumn,
				});
			}
		}

		return catalog;
	}

	private findRelationPath(
		catalog: Map<string, ResourceCatalogEntry>,
		startResourceType: string,
		targetResourceType: string,
	): RelationTraversalStep[] | null {
		if (startResourceType === targetResourceType) {
			return [];
		}

		const queue: Array<{
			resourceType: string;
			path: RelationTraversalStep[];
		}> = [{ resourceType: startResourceType, path: [] }];
		const visited = new Set<string>([startResourceType]);

		while (queue.length > 0) {
			const current = queue.shift();
			if (!current) {
				break;
			}

			const outgoing = catalog.get(current.resourceType)?.relations ?? [];
			for (const relation of outgoing) {
				if (visited.has(relation.targetResourceType)) {
					continue;
				}

				const nextPath = [
					...current.path,
					{
						direction: 'forward' as const,
						relation,
						nextResourceType: relation.targetResourceType,
					},
				];
				if (relation.targetResourceType === targetResourceType) {
					return nextPath;
				}

				visited.add(relation.targetResourceType);
				queue.push({
					resourceType: relation.targetResourceType,
					path: nextPath,
				});
			}

			for (const entry of catalog.values()) {
				for (const relation of entry.relations) {
					if (relation.targetResourceType !== current.resourceType) {
						continue;
					}

					if (visited.has(relation.sourceResourceType)) {
						continue;
					}

					const nextPath = [
						...current.path,
						{
							direction: 'backward' as const,
							relation,
							nextResourceType: relation.sourceResourceType,
						},
					];
					if (relation.sourceResourceType === targetResourceType) {
						return nextPath;
					}

					visited.add(relation.sourceResourceType);
					queue.push({
						resourceType: relation.sourceResourceType,
						path: nextPath,
					});
				}
			}
		}

		return null;
	}

	private resolveFieldMetadata(
		entry: ResourceCatalogEntry,
		predicate: ScenarioPredicate | ScenarioSort,
	): ResourceFieldMetadata {
		const lookupKey = normalizeLookupKey(predicate.field);

		if (lookupKey === 'age' && entry.resourceType === 'Patient') {
			const birthdayField =
				entry.fieldMap.get(normalizeLookupKey('birthday')) ?? entry.fieldMap.get(normalizeLookupKey('birthDate'));
			if (!birthdayField) {
				throw new Error('Patient age predicates require a birthday/birthDate field');
			}

			return birthdayField;
		}

		const field = entry.fieldMap.get(lookupKey);
		if (!field) {
			throw new Error(`Field ${predicate.field} is not available for scenario queries on ${entry.resourceType}`);
		}

		return field;
	}

	private buildPredicateClause(
		alias: string,
		entry: ResourceCatalogEntry,
		predicate: ScenarioPredicate,
		parameters: unknown[],
	): string {
		const field = this.resolveFieldMetadata(entry, predicate);
		const columnSql = `${alias}.${quoteIdentifier(field.column)}`;

		if (normalizeLookupKey(predicate.field) === 'age') {
			const boundary = buildAgeBoundary(predicate.operator, predicate.value as ScenarioValue);
			parameters.push(boundary);

			if (predicate.operator === 'gte') {
				return `${columnSql} <= $${parameters.length}`;
			}

			if (predicate.operator === 'lte') {
				return `${columnSql} >= $${parameters.length}`;
			}
		}

		if (predicate.operator === 'eq') {
			parameters.push(predicate.value);
			return `${columnSql} = $${parameters.length}`;
		}

		if (predicate.operator === 'in') {
			parameters.push((predicate.value as ScenarioValue[]).map(String));
			return `${columnSql}::text = ANY($${parameters.length}::text[])`;
		}

		parameters.push(predicate.value);
		return `${columnSql} ${predicate.operator === 'gte' ? '>=' : '<='} $${parameters.length}`;
	}

	private buildSortClause(anchorAlias: string, entry: ResourceCatalogEntry, sort: ScenarioSort | null): string {
		if (!sort) {
			return `${anchorAlias}.${quoteIdentifier(entry.idColumn)} ASC`;
		}

		const field = this.resolveFieldMetadata(entry, sort);

		return `${anchorAlias}.${quoteIdentifier(field.column)} ${sort.direction.toUpperCase()}`;
	}

	async findScenarioResourceIds(params: {
		igName: string;
		igVersion: string;
		plan: ScenarioQueryPlan;
	}): Promise<Record<string, string[]>> {
		const catalog = await this.buildResourceCatalog({
			igName: params.igName,
			igVersion: params.igVersion,
		});
		const anchor = catalog.get(params.plan.anchorResourceType);
		if (!anchor) {
			throw new Error(`Unknown anchor resource type ${params.plan.anchorResourceType}`);
		}

		const parameters: unknown[] = [];
		const whereClauses = params.plan.predicates.map((predicate, predicateIndex) => {
			if (predicate.resourceType === anchor.resourceType) {
				return this.buildPredicateClause('anchor', anchor, predicate, parameters);
			}

			const path = this.findRelationPath(catalog, anchor.resourceType, predicate.resourceType);
			if (!path) {
				throw new Error(`No relation path found from ${anchor.resourceType} to ${predicate.resourceType}`);
			}

			const targetEntry = catalog.get(predicate.resourceType);
			if (!targetEntry) {
				throw new Error(`Unknown resource type ${predicate.resourceType}`);
			}

			const fromClauses: string[] = [];
			const whereConditions: string[] = [];
			let currentAlias = 'anchor';
			let currentEntry = anchor;

			path.forEach((step, stepIndex) => {
				const nextEntry = catalog.get(step.nextResourceType);
				if (!nextEntry) {
					throw new Error(`Unknown resource type ${step.nextResourceType}`);
				}

				const nextAlias = `p${predicateIndex}_${stepIndex}`;
				if (stepIndex === 0) {
					fromClauses.push(`FROM ${quoteQualifiedTableName(nextEntry.baseTable)} ${nextAlias}`);
				} else {
					fromClauses.push(`JOIN ${quoteQualifiedTableName(nextEntry.baseTable)} ${nextAlias}`);
				}

				if (step.direction === 'forward') {
					whereConditions.push(
						`${currentAlias}.${quoteIdentifier(step.relation.sourceReferenceColumn)} = ${nextAlias}.${quoteIdentifier(step.relation.targetIdColumn)}`,
					);
				} else {
					whereConditions.push(
						`${nextAlias}.${quoteIdentifier(step.relation.sourceReferenceColumn)} = ${currentAlias}.${quoteIdentifier(currentEntry.idColumn)}`,
					);
				}

				currentAlias = nextAlias;
				currentEntry = nextEntry;
			});

			whereConditions.push(this.buildPredicateClause(currentAlias, targetEntry, predicate, parameters));

			return `EXISTS (SELECT 1 ${fromClauses.join(' ')} WHERE ${whereConditions.join(' AND ')})`;
		});

		parameters.push(params.plan.anchorLimit);
		const anchorQuery = `
			SELECT anchor.${quoteIdentifier(anchor.idColumn)} AS resource_id
			FROM ${quoteQualifiedTableName(anchor.baseTable)} anchor
			${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
			ORDER BY ${this.buildSortClause('anchor', anchor, params.plan.sort)}
			LIMIT $${parameters.length}
		`;
		const anchorResult = await this.pool.query<{ resource_id: string }>(anchorQuery, parameters);
		const selectedResourceIds: Record<string, string[]> = {
			[anchor.resourceType]: anchorResult.rows.map((row) => row.resource_id),
		};

		for (const resourceType of params.plan.includeResourceTypes) {
			if (resourceType === anchor.resourceType) {
				continue;
			}

			const path = this.findRelationPath(catalog, anchor.resourceType, resourceType);
			if (!path) {
				throw new Error(`No relation path found from ${anchor.resourceType} to ${resourceType}`);
			}

			let currentIds = selectedResourceIds[anchor.resourceType];
			let currentResourceType = anchor.resourceType;

			for (const step of path) {
				if (currentIds.length === 0) {
					break;
				}

				const query =
					step.direction === 'forward'
						? `
							SELECT DISTINCT ${quoteIdentifier(step.relation.sourceReferenceColumn)} AS resource_id
							FROM ${quoteQualifiedTableName(step.relation.sourceTable)}
							WHERE ${quoteIdentifier(step.relation.sourceIdColumn)} = ANY($1::text[])
								AND ${quoteIdentifier(step.relation.sourceReferenceColumn)} IS NOT NULL
						`
						: `
							SELECT DISTINCT ${quoteIdentifier(step.relation.sourceIdColumn)} AS resource_id
							FROM ${quoteQualifiedTableName(step.relation.sourceTable)}
							WHERE ${quoteIdentifier(step.relation.sourceReferenceColumn)} = ANY($1::text[])
						`;
				const result = await this.pool.query<{ resource_id: string }>(query, [currentIds]);
				currentIds = result.rows.map((row) => row.resource_id);
				currentResourceType = step.nextResourceType;
			}

			selectedResourceIds[currentResourceType] = [...new Set(currentIds)];
		}

		return selectedResourceIds;
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
