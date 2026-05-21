import { fileURLToPath } from 'node:url';
import globals from 'globals';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default [
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	...tseslint.configs.recommended,
	prettierConfig,
	{
		files: ['**/*.{js,mjs,cjs}'],
		rules: {
			'sort-imports': ['warn', { allowSeparatedGroups: true }],
			'no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
			],
		},
	},
	{
		files: ['**/*.{ts,tsx,mts,cts}'],
		rules: {
			'sort-imports': ['warn', { allowSeparatedGroups: true }],
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					args: 'none',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
				},
			],
		},
	},
	{
		files: ['**/*.js', '**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
	},
];
