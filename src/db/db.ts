import { Pool } from 'pg';
import { DB, Json } from './types';
import { Kysely, PostgresDialect, RawBuilder, sql } from 'kysely';

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
