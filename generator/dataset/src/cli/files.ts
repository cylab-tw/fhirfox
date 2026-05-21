import { readFileSync, readdirSync, statSync } from 'node:fs';
import YAML from 'yaml';
import { resolve } from 'node:path';

import type { ResourceTypeDefinition } from '#/model/index.js';

/** Parsed YAML file with its absolute path. */
export interface LoadedYamlFile<T> {
	file: string;
	value: T;
}

/** Reads every YAML file in a directory tree. */
export function readYamlDirectory<T>(directory: string): T[] {
	return readYamlFiles<T>(directory).map((entry) => entry.value);
}

/** Reads every YAML file in a directory tree with file paths. */
export function readYamlFiles<T>(directory: string): LoadedYamlFile<T>[] {
	return listYamlFiles(resolve(directory)).map((file) => ({
		file,
		value: readYamlFile<T>(file),
	}));
}

/** Reads YAML files that look like resource type definitions and skips shared catalog files. */
export function readResourceTypeDefinitionFiles(directory: string): LoadedYamlFile<ResourceTypeDefinition>[] {
	return readYamlFiles<unknown>(directory).filter((entry): entry is LoadedYamlFile<ResourceTypeDefinition> =>
		isResourceTypeDefinition(entry.value),
	);
}

/** Reads one YAML file. */
export function readYamlFile<T>(file: string): T {
	return YAML.parse(readFileSync(file, 'utf8')) as T;
}

function listYamlFiles(directory: string): string[] {
	return readdirSync(directory)
		.flatMap((entry) => {
			const file = resolve(directory, entry);
			return statSync(file).isDirectory() ? listYamlFiles(file) : [file];
		})
		.filter((file) => file.endsWith('.yaml') || file.endsWith('.yml'))
		.sort();
}

function isResourceTypeDefinition(value: unknown): value is ResourceTypeDefinition {
	return typeof value === 'object' && value !== null && Array.isArray((value as Record<string, unknown>).fields);
}
