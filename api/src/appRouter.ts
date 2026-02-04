import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import { db } from './db';
import superjson from 'superjson';

type User = {
  id: string; // uuidv7
};
export type Context = {
  user: User | null;
};

export const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

// procedure that can be done without authentication
export const publicProcedure = t.procedure;

// procedure that asserts that the user is logged in
export const authedProcedure = t.procedure.use(async function isAuthed(opts) {
  const { ctx } = opts;
  // `ctx.user` is nullable
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return opts.next({
    ctx: {
      user: ctx.user,
    },
  });
});

export const appRouter = t.router({
  post: {
    fetchMostRecent: publicProcedure.input(z.number()).query(async (opts) => {
      return await db.selectFrom('post').selectAll().orderBy('created_at', 'desc').limit(opts.input).execute();
    }),
    interactions: {
      getStats: publicProcedure.input(z.uuidv7()).query(async (opts) => {
        const postId = opts.input;
        const { likes } = await db
          .selectFrom('like')
          .where('post_id', '=', postId)
          .select(db.fn.countAll<number>().as('likes'))
          .executeTakeFirstOrThrow();
        const { reposts } = await db
          .selectFrom('repost')
          .where('post_id', '=', postId)
          .select(db.fn.countAll<number>().as('reposts'))
          .executeTakeFirstOrThrow();
        const replies = (
          await db.selectFrom('post').where('post.id', '=', postId).select('post.replies').executeTakeFirstOrThrow()
        ).replies?.length;
        return { postId: opts.input, likes, reposts, replies };
      }),
      byUser: authedProcedure.input(z.uuidv7()).query(async (opts) => {
        const { id: userId } = opts.ctx.user;
        const postId = opts.input;

        const liked =
          (await db
            .selectFrom('like')
            .select('liker_id')
            .where('liker_id', '=', userId)
            .where('post_id', '=', postId)
            .executeTakeFirst()) != undefined;
        const reposted =
          (await db
            .selectFrom('repost')
            .select('reposter_id')
            .where('reposter_id', '=', userId)
            .where('post_id', '=', postId)
            .executeTakeFirst()) != undefined;

        return { postId: opts.input, liked, reposted };
      }),
    },
    setLikeOnPost: authedProcedure
      .input(
        z.object({
          postId: z.uuidv7(),
          likeState: z.boolean(),
        }),
      )
      .mutation(async (opts) => {
        const { postId: post_id, likeState: liked } = opts.input;
        const liker_id = opts.ctx.user.id;

        // TODOO: error if unliking and there exists no like, or liking twice ?
        if (liked) {
          await db
            .insertInto('like')
            .values({
              liker_id,
              post_id,
            })
            .execute();
        } else {
          await db.deleteFrom('like').where('liker_id', '=', liker_id).where('post_id', '=', post_id).execute();
        }
      }),
    setRepost: authedProcedure
      .input(
        z.object({
          postId: z.uuidv7(),
          repostState: z.boolean(),
        }),
      )
      .mutation(async (opts) => {
        const { postId: post_id, repostState: reposted } = opts.input;
        const reposter_id = opts.ctx.user.id;

        // TODOO: error if unliking and there exists no like, or liking twice ?
        if (reposted) {
          await db
            .insertInto('repost')
            .values({
              reposter_id,
              post_id,
            })
            .execute();
        } else {
          await db.deleteFrom('repost').where('reposter_id', '=', reposter_id).where('post_id', '=', post_id).execute();
        }
      }),
    // postReply:
  },
});
// export type definition of API
export type AppRouter = typeof appRouter;
