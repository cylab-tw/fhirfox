import { fileURLToPath } from 'node:url';
import globals from 'globals';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default [
	includeIgnoreFile(gitignorePath),
	{
		ignores: ['dist/**', 'node_modules/**'],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	prettierConfig,
	{
		rules: {
			'sort-imports': ['warn', { allowSeparatedGroups: true }],
		},
	},
	{
		languageOptions: {
			globals: { ...globals.node },
		},
	},
];
