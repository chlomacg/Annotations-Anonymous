import { RawBuilder, sql } from 'kysely';

export function json<T>(object: T): RawBuilder<T> {
  return sql`cast (${JSON.stringify(object)} as jsonb)`;
}

export type Simplify<T> = {
  [K in keyof T]: T[K];
};

export type ChangeFieldIn<T, KF extends keyof T, TF> = {
  [K in keyof Omit<T, KF>]: T[K];
} & {
  [P in KF]: TF;
};
