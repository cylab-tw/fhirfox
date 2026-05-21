import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { createBackendManifest, loadBackendCatalog, resolveBackendScenario } from './catalog.js';
import { JsonBackendStore } from './store.js';

import type { BackendManifest, UserRecord } from './types.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface BackendServerOptions {
	repoRoot?: string;
	apiBaseUrl?: string;
	defaultSeed?: string;
	dataFilePath?: string;
	port?: number;
	host?: string;
}

export interface BackendServerHandle {
	server: ReturnType<typeof createServer>;
	url: string;
	manifest: BackendManifest;
	close(): Promise<void>;
}

export async function startBackendServer(options: BackendServerOptions = {}): Promise<BackendServerHandle> {
	const repoRoot = options.repoRoot ?? defaultRepoRoot();
	const apiBaseUrl = normalizeApiBaseUrl(options.apiBaseUrl ?? '/api');
	const catalog = await loadBackendCatalog(repoRoot);
	const manifest = createBackendManifest(apiBaseUrl, options.defaultSeed ?? '1234');
	const store = new JsonBackendStore(options.dataFilePath ?? path.join(repoRoot, '.cache', 'backend', 'state.json'));

	const server = createServer(async (request, response) => {
		try {
			const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
			const pathname = stripTrailingSlash(url.pathname);

			if (request.method === 'GET' && pathname === '/api/manifest') {
				sendJson(response, manifest);
				return;
			}

			if (request.method === 'GET' && pathname === '/api/scenario-index') {
				sendJson(response, catalog.scenarioIndex);
				return;
			}

			if (request.method === 'GET' && pathname === '/api/source-field-docs') {
				sendJson(response, catalog.sourceFieldDocs);
				return;
			}

			if (request.method === 'GET' && pathname === '/api/source-code-displays') {
				sendJson(response, catalog.sourceCodeDisplayMap);
				return;
			}

			if (pathname === '/api/users' && request.method === 'GET') {
				sendJson(response, await store.listUsers());
				return;
			}

			if (pathname === '/api/users' && request.method === 'POST') {
				const body = await readJsonBody<{ id?: string; displayName?: string }>(request);
				sendJson(response, await store.upsertUser(normalizeUserId(body.id), body.displayName));
				return;
			}

			if (pathname === '/api/login' && request.method === 'POST') {
				const body = await readJsonBody<{ userId?: string; displayName?: string }>(request);
				const user = await store.upsertUser(normalizeUserId(body.userId), body.displayName);
				response.setHeader('Set-Cookie', `fhirfox-user-id=${encodeURIComponent(user.id)}; Path=/; SameSite=Lax`);
				sendJson(response, user);
				return;
			}

			if (pathname === '/api/generations' && request.method === 'GET') {
				sendJson(response, await store.listGenerations());
				return;
			}

			const scenarioResolveMatch = /^\/api\/scenarios\/([^/]+)\/resolve$/u.exec(pathname);
			if (scenarioResolveMatch && request.method === 'GET') {
				const scenarioId = decodeURIComponent(scenarioResolveMatch[1] ?? '');
				const seed = url.searchParams.get('seed') ?? manifest.dataSource.defaultSeed ?? '1234';
				const currentUser = await resolveCurrentUser(request, store);
				const generatedAt = new Date().toISOString();
				const resolved = await resolveBackendScenario(catalog, scenarioId, {
					seed,
					generatedAt,
					now: new Date(generatedAt),
				});
				const generation = await store.recordGeneration({
					scenarioId,
					userId: currentUser.id,
					seed,
					requestedAt: generatedAt,
					generatedAt,
				});
				sendJson(response, {
					...resolved,
					generation,
				});
				return;
			}

			sendJson(response, { error: 'Not found' }, 404);
		} catch (error) {
			sendJson(response, { error: error instanceof Error ? error.message : String(error) }, 500);
		}
	});

	await new Promise<void>((resolve) => {
		server.listen(options.port ?? 0, options.host ?? '127.0.0.1', resolve);
	});

	const address = server.address();
	const port = typeof address === 'object' && address ? address.port : 0;
	const url = `http://127.0.0.1:${port}`;

	return {
		server,
		url,
		manifest,
		close: async () => {
			await new Promise<void>((resolve, reject) => {
				server.close((error) => (error ? reject(error) : resolve()));
			});
		},
	};
}

function defaultRepoRoot(): string {
	return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
}

function normalizeApiBaseUrl(value: string): string {
	const trimmed = value.trim();

	if (!trimmed || trimmed === '/') {
		return '/api';
	}

	return trimmed.startsWith('/') ? trimmed.replace(/\/+$/u, '') : `/${trimmed.replace(/\/+$/u, '')}`;
}

function stripTrailingSlash(pathname: string): string {
	return pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
}

function sendJson(response: ServerResponse, value: unknown, status = 200): void {
	response.statusCode = status;
	response.setHeader('Content-Type', 'application/json; charset=utf-8');
	response.end(`${JSON.stringify(value, null, 2)}\n`);
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
	const chunks: Buffer[] = [];

	for await (const chunk of request) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}

	const text = Buffer.concat(chunks).toString('utf8').trim();

	if (!text) {
		return {} as T;
	}

	return JSON.parse(text) as T;
}

function normalizeUserId(value: unknown): string {
	if (typeof value === 'string' && value.trim().length > 0) {
		return value.trim();
	}

	return 'anonymous';
}

async function resolveCurrentUser(request: IncomingMessage, store: JsonBackendStore): Promise<UserRecord> {
	const cookie = request.headers.cookie ?? '';
	const matched = /(?:^|;\s*)fhirfox-user-id=([^;]+)/u.exec(cookie);
	const userId = matched ? decodeURIComponent(matched[1] ?? '') : 'anonymous';
	return store.ensureUser(normalizeUserId(userId));
}
