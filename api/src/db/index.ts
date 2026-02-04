import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import { type Kyselify } from 'drizzle-orm/kysely';
import { tables } from './schema';

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
});

type Tables = typeof tables;
export type DB = {
  [K in keyof Tables]: Kyselify<Tables[K]>;
};

export const db = new Kysely<DB>({
  dialect,
});
