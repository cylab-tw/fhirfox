export type ScenarioValue = string | number | boolean;

export interface ScenarioFieldConstraintInput {
	eq?: ScenarioValue;
	in?: ScenarioValue[];
	min?: number;
	max?: number;
}

export type ScenarioFieldInput = ScenarioValue | ScenarioValue[] | ScenarioFieldConstraintInput;

export type ScenarioResourceBlockInput = Record<string, ScenarioFieldInput>;

export interface ScenarioAnchorInput {
	resourceType: string;
	limit?: number;
	sort?: {
		field: string;
		direction?: 'asc' | 'desc';
	};
}

export interface ScenarioDefinition {
	id: string;
	name?: string;
	level?: number;
	description?: string;
	focus?: string;
	journey?: string;
	type?: string;
	department?: string;
	anchor?: ScenarioAnchorInput;
	criteria?: Record<string, Record<string, ScenarioFieldInput>>;
	resources?: {
		include?: string[];
	};
	[key: string]: unknown;
}

export type ScenarioOperator = 'eq' | 'in' | 'gte' | 'lte';

export interface ScenarioPredicate {
	resourceType: string;
	field: string;
	operator: ScenarioOperator;
	value: ScenarioValue | ScenarioValue[];
}

export interface ScenarioSort {
	resourceType: string;
	field: string;
	direction: 'asc' | 'desc';
}

export interface ScenarioQueryPlan {
	id: string;
	name: string;
	level: number;
	description: string | null;
	anchorResourceType: string;
	anchorLimit: number;
	sort: ScenarioSort | null;
	predicates: ScenarioPredicate[];
	includeResourceTypes: string[];
}

export interface ScenarioExecutionResult {
	scenario: ScenarioQueryPlan;
	selectedResourceIds: Record<string, string[]>;
	resources: unknown[];
}
