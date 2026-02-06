import { relations } from 'drizzle-orm/relations';
import { user, session, account, post, like, repost } from './schema';

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const likeRelations = relations(like, ({ one }) => ({
  post: one(post, {
    fields: [like.postId],
    references: [post.id],
  }),
}));

export const postRelations = relations(post, ({ many }) => ({
  likes: many(like),
  reposts: many(repost),
}));

export const repostRelations = relations(repost, ({ one }) => ({
  post: one(post, {
    fields: [repost.postId],
    references: [post.id],
  }),
}));
