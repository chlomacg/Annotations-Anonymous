import { Pool } from "pg";
import { DB } from "kysely-codegen";
import { Kysely, PostgresDialect } from "kysely";

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
});

export const db = new Kysely<DB>({
  dialect,
});

// export interface Database {
//     annotation: PostTable,
// }

// export interface PostTable {
//     id: Generated<number>,
//     author:
// }

// export type Post = Selectable<PostTable>;
// export type NewPost = Insertable<PostTable>;
// export type PostUpdate = Updateable<PostTable>;
