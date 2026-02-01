import { Kysely, sql } from 'kysely';

/*
     author_id uuid NOT NULL,
    author_handle character varying(24) NOT NULL,
    content jsonb NOT NULL,
    times_edited timestamp with time zone[] NOT NULL

*/

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('draft')
    .addColumn('author_id', 'uuid', (col) => col.primaryKey().notNull())
    .addColumn('author_handle', 'varchar(24)', (col) => col.notNull())
    .addColumn('content', 'jsonb', (col) => col.notNull())
    .addColumn('time_most_recently_edited', 'timestamptz', (col) => col.notNull())
    .execute();

  await db.schema
    .createTable('post')
    .addColumn('id', 'uuid', (col) => col.defaultTo(sql`uuidv7()`).primaryKey())
    .addColumn('author_id', 'uuid', (col) => col.references('draft.author_id').notNull())
    .addColumn('author_handle', 'varchar(24)', (col) => col.notNull())
    .addColumn('author_display_name', 'varchar(40)', (col) => col.notNull())
    .addColumn('time_created', 'timestamptz', (col) => col.notNull())
    .addColumn('content', 'jsonb', (col) => col.notNull())
    .addColumn('replies', sql`uuid[]`)
    .addColumn('reposted_by', sql`uuid[]`)
    .addColumn('liked_by', sql`uuid[]`)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('post').execute();
  await db.schema.dropTable('draft').execute();
}
