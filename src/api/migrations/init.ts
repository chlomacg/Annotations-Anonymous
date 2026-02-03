import { Kysely, sql } from 'kysely';

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
    .addColumn('author_id', 'uuid', (col) => col.notNull())
    .addColumn('author_handle', 'varchar(24)', (col) => col.notNull())
    .addColumn('author_display_name', 'varchar(40)', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .addColumn('content', 'jsonb', (col) => col.notNull())
    .addColumn('replies', sql`uuid[]`, (col) => col.defaultTo(sql`array[]::uuid[]`))
    .execute();

  await db.schema
    .createTable('repost') // TODOO: add quote repost support
    .addColumn('post_id', 'uuid', (col) => col.references('post.id'))
    .addColumn('reposter_id', 'uuid', (col) => col.notNull()) // TODOO: reference user table and make index
    .addColumn('created_at', 'timestamptz')
    .addPrimaryKeyConstraint('repost_pkey', ['reposter_id', 'post_id'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('like').execute();
  await db.schema.dropTable('repost').execute();
  await db.schema.dropTable('post').execute();
  await db.schema.dropTable('draft').execute();
}
