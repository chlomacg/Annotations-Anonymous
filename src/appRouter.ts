import { initTRPC } from '@trpc/server';
import { z } from 'zod';

// todo: implement auth context
export const createContext = async (/* opts: CreateNextContextOptions */) => {
  //   const session = await getSession({ req: opts.req });

  //   return { session };
  return {};
};
export type Context = Awaited<ReturnType<typeof createContext>>;
export const t = initTRPC.context<Context>().create();

export const appRouter = t.router({
  getInteractionsFromUserOnPost: t.procedure.input(z.uuidv7()).query((opts) => {
    return { postId: opts.input, liked: true, reposted: true };
  }),
  createUser: t.procedure.input(z.object({ name: z.string().min(5) })).mutation(async (opts) => {
    return await doStuff();
  }),
});
// export type definition of API
export type AppRouter = typeof appRouter;

async function doStuff() {
  console.log('Hello');
}
