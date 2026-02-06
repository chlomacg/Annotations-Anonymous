import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  integer,
  index,
  foreignKey,
  unique,
  text,
  boolean,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const draft = pgTable('draft', {
  authorId: uuid('author_id').primaryKey().notNull(),
  authorHandle: varchar('author_handle', { length: 24 }).notNull(),
  content: jsonb().notNull(),
  timeMostRecentlyEdited: timestamp('time_most_recently_edited', { withTimezone: true, mode: 'date' })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const kyselyMigration = pgTable('kysely_migration', {
  name: varchar({ length: 255 }).primaryKey().notNull(),
  timestamp: varchar({ length: 255 }).notNull(),
});

export const kyselyMigrationLock = pgTable('kysely_migration_lock', {
  id: varchar({ length: 255 }).primaryKey().notNull(),
  isLocked: integer('is_locked').default(0).notNull(),
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
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  content: jsonb().notNull(),
  replies: uuid().array().default(['RAY']).notNull(),
});

export const session = pgTable(
  'session',
  {
    id: text().primaryKey().notNull(),
    expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
    token: text().notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id').notNull(),
  },
  (table) => [
    index('session_userId_idx').using('btree', table.userId.asc().nullsLast().op('text_ops')),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'session_user_id_user_id_fk',
    }).onDelete('cascade'),
    unique('session_token_unique').on(table.token),
  ],
);

export const user = pgTable(
  'user',
  {
    id: text().primaryKey().notNull(),
    name: text().notNull(),
    email: text().notNull(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    image: text(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [unique('user_email_unique').on(table.email)],
);

export const verification = pgTable(
  'verification',
  {
    id: text().primaryKey().notNull(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [index('verification_identifier_idx').using('btree', table.identifier.asc().nullsLast().op('text_ops'))],
);

export const account = pgTable(
  'account',
  {
    id: text().primaryKey().notNull(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { mode: 'date' }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { mode: 'date' }),
    scope: text(),
    password: text(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
  },
  (table) => [
    index('account_userId_idx').using('btree', table.userId.asc().nullsLast().op('text_ops')),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'account_user_id_user_id_fk',
    }).onDelete('cascade'),
  ],
);

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
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
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
