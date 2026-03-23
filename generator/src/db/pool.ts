import { Pool } from 'pg';

let pool: Pool | null = null;

function createPool(): Pool {
	const connectionString = process.env.DATABASE_URL;

	if (connectionString) {
		return new Pool({ connectionString });
	}

	return new Pool();
}

export function getPool(): Pool {
	pool ??= createPool();
	return pool;
}
