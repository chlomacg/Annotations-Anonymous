import { RawBuilder, sql } from 'kysely';

export function json<T>(object: T): RawBuilder<T> {
  return sql`cast (${JSON.stringify(object)} as jsonb)`;
}
