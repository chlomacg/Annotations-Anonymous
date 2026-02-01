import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';

type User = {
  id: string; // uuidv7
};
export type Context = {
  user: User | null;
};
export const t = initTRPC.context<Context>().create();

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
    interactions: {
      getStats: publicProcedure.input(z.uuidv7()).query((opts) => {
        return { postId: opts.input, likes: 20, reposts: 1, replies: 3 };
      }),
      byUser: authedProcedure.input(z.uuidv7()).query((opts) => {
        return { postId: opts.input, liked: true, reposted: true };
      }),
    },
    setLikeOnPost: authedProcedure
      .input(
        z.object({
          postId: z.uuidv7(),
          likeState: z.boolean(),
        }),
      )
      .mutation(() => {}),
    setRepost: authedProcedure
      .input(
        z.object({
          postId: z.uuidv7(),
          repostState: z.boolean(),
        }),
      )
      .mutation(() => {}),
    // postReply:
  },
});
// export type definition of API
export type AppRouter = typeof appRouter;
