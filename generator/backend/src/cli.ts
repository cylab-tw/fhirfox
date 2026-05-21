import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { startBackendServer } from './server.js';

async function main(): Promise<void> {
	const command = process.argv[2] ?? 'serve';

	if (command !== 'serve') {
		throw new Error(`Unknown command "${command}".`);
	}

	const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
	await loadEnvFile(path.join(packageRoot, '.env'));
	await loadEnvFile(path.join(packageRoot, '.env.local'));

	const server = await startBackendServer({
		repoRoot: process.env.FHIRFOX_REPO_ROOT ? path.resolve(process.env.FHIRFOX_REPO_ROOT) : undefined,
		apiBaseUrl: process.env.FHIRFOX_API_BASE_URL,
		defaultSeed: process.env.FHIRFOX_DEFAULT_SEED,
		dataFilePath: process.env.FHIRFOX_BACKEND_STATE_FILE,
		port: parsePort(process.env.PORT),
		host: process.env.HOST,
	});

	console.log(`Backend server listening at ${server.url}`);

	process.on('SIGINT', async () => {
		await server.close();
		process.exit(0);
	});
}

void main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});

function parsePort(value: string | undefined): number | undefined {
	if (!value) {
		return undefined;
	}

	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function loadEnvFile(filePath: string): Promise<void> {
	try {
		const content = await readFile(filePath, 'utf8');
		const parsed = parseEnvFile(content);

		for (const [key, value] of Object.entries(parsed)) {
			if (process.env[key] === undefined) {
				process.env[key] = value;
			}
		}
	} catch {
		// Missing env files are fine.
	}
}

function parseEnvFile(content: string): Record<string, string> {
	const env: Record<string, string> = {};

	for (const line of content.split(/\r?\n/u)) {
		const trimmed = line.trim();

		if (!trimmed || trimmed.startsWith('#')) {
			continue;
		}

		const separatorIndex = trimmed.indexOf('=');

		if (separatorIndex < 0) {
			continue;
		}

		const key = trimmed.slice(0, separatorIndex).trim();
		const value = trimmed.slice(separatorIndex + 1).trim();

		if (key) {
			env[key] = value;
		}
	}

	return env;
}
