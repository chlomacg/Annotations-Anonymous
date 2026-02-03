import { Pool } from 'pg';
import type { DB, Json } from './types';
import { Kysely, PostgresDialect, type RawBuilder, sql } from 'kysely';
export * from './types';

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
});

export const db = new Kysely<DB>({
  dialect,
});

export function json<T>(value: T): RawBuilder<Json> {
  return sql`${JSON.stringify(value)}`;
}
