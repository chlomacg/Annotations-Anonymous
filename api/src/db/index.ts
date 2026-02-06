import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import { type Kyselify } from 'drizzle-orm/kysely';
import * as tables from './schema';
import { drizzle } from 'drizzle-orm/postgres-js';

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
});

export const drizzledb = drizzle(process.env.DATABASE_URL as string);

type Tables = typeof tables;
export type DB = {
  [K in keyof Tables]: Kyselify<Tables[K]>;
};

export const db = new Kysely<DB>({
  dialect,
});
