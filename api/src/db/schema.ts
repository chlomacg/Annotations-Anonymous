import { pgTable, varchar, integer, uuid, jsonb, timestamp, foreignKey, primaryKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { PortableTextBlock } from '@portabletext/editor';

export const kyselyMigration = pgTable('kysely_migration', {
  name: varchar({ length: 255 }).primaryKey().notNull(),
  timestamp: varchar({ length: 255 }).notNull(),
});

export const kyselyMigrationLock = pgTable('kysely_migration_lock', {
  id: varchar({ length: 255 }).primaryKey().notNull(),
  isLocked: integer('is_locked').default(0).notNull(),
});

export const draft = pgTable('draft', {
  authorId: uuid('author_id').primaryKey().notNull(),
  authorHandle: varchar('author_handle', { length: 24 }).notNull(),
  content: jsonb().notNull(),
  timeMostRecentlyEdited: timestamp('time_most_recently_edited', { withTimezone: true, mode: 'date' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const post = pgTable('post', {
  id: uuid()
    .default(sql`uuidv7()`)
    .primaryKey()
    .notNull(),
  authorId: uuid('author_id').notNull(),
  authorHandle: varchar('author_handle', { length: 24 }).notNull(),
  authorDisplayName: varchar('author_display_name', { length: 40 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  content: jsonb().$type<PortableTextBlock[]>().notNull(),
  replies: uuid()
    .array()
    .notNull()
    .default(sql`ARRAY[]::uuid[]`),
});

export const like = pgTable(
  'like',
  {
    postId: uuid('post_id').notNull(),
    likerId: uuid('liker_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    foreignKey({
      columns: [table.postId],
      foreignColumns: [post.id],
      name: 'like_post_id_fkey',
    }),
    primaryKey({ columns: [table.postId, table.likerId], name: 'like_pkey' }),
  ],
);

export const repost = pgTable(
  'repost',
  {
    postId: uuid('post_id').notNull(),
    reposterId: uuid('reposter_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    foreignKey({
      columns: [table.postId],
      foreignColumns: [post.id],
      name: 'repost_post_id_fkey',
    }),
    primaryKey({ columns: [table.reposterId, table.postId], name: 'repost_pkey' }),
  ],
);

export const tables = { draft, post, like, repost };
