import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import type { BackendState, GenerationRecord, UserRecord } from './types.js';

export class JsonBackendStore {
	private statePromise: Promise<BackendState> | null = null;
	private writeQueue: Promise<void> = Promise.resolve();

	constructor(private readonly filePath: string) {}

	async listUsers(): Promise<UserRecord[]> {
		const state = await this.readState();
		return [...state.users];
	}

	async upsertUser(userId: string, displayName?: string): Promise<UserRecord> {
		return this.enqueue(async () => {
			const state = await this.readState();
			const now = new Date().toISOString();
			const existing = state.users.find((user) => user.id === userId);

			if (existing) {
				existing.lastLoginAt = now;
				if (displayName) {
					existing.displayName = displayName;
				}
				await this.writeState(state);
				return existing;
			}

			const user: UserRecord = {
				id: userId,
				createdAt: now,
				lastLoginAt: now,
				displayName,
			};
			state.users.push(user);
			await this.writeState(state);
			return user;
		});
	}

	async recordGeneration(input: Omit<GenerationRecord, 'id'>): Promise<GenerationRecord> {
		return this.enqueue(async () => {
			const state = await this.readState();
			const record: GenerationRecord = {
				id: randomUUID(),
				...input,
			};
			state.generations.push(record);
			await this.writeState(state);
			return record;
		});
	}

	async listGenerations(): Promise<GenerationRecord[]> {
		const state = await this.readState();
		return [...state.generations];
	}

	async findUser(userId: string): Promise<UserRecord | null> {
		const state = await this.readState();
		return state.users.find((user) => user.id === userId) ?? null;
	}

	async ensureUser(userId: string, displayName?: string): Promise<UserRecord> {
		const existing = await this.findUser(userId);
		if (existing) {
			return existing;
		}

		return this.upsertUser(userId, displayName);
	}

	private async readState(): Promise<BackendState> {
		this.statePromise ??= this.loadState();
		return this.statePromise;
	}

	private async loadState(): Promise<BackendState> {
		try {
			const content = await readFile(this.filePath, 'utf8');
			const parsed = JSON.parse(content) as BackendState;
			return {
				users: Array.isArray(parsed.users) ? parsed.users : [],
				generations: Array.isArray(parsed.generations) ? parsed.generations : [],
			};
		} catch {
			return { users: [], generations: [] };
		}
	}

	private async writeState(state: BackendState): Promise<void> {
		const directory = path.dirname(this.filePath);
		await mkdir(directory, { recursive: true });
		await writeFile(this.filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
	}

	private enqueue<T>(task: () => Promise<T>): Promise<T> {
		const run = this.writeQueue.then(task, task);
		this.writeQueue = run.then(
			() => undefined,
			() => undefined,
		);
		return run;
	}
}
