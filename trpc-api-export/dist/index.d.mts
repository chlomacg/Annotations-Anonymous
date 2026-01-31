import * as _trpc_server from '@trpc/server';

declare const appRouter: _trpc_server.TRPCBuiltRouter<
  {
    ctx: {};
    meta: object;
    errorShape: _trpc_server.TRPCDefaultErrorShape;
    transformer: false;
  },
  _trpc_server.TRPCDecorateCreateRouterOptions<{
    getInteractionsFromUserOnPost: _trpc_server.TRPCQueryProcedure<{
      input: string;
      output: {
        postId: string;
        liked: boolean;
        reposted: boolean;
      };
      meta: object;
    }>;
    createUser: _trpc_server.TRPCMutationProcedure<{
      input: {
        name: string;
      };
      output: void;
      meta: object;
    }>;
  }>
>;
type AppRouter = typeof appRouter;

type Square = {
  shape: 'square';
  size: number;
};
type Rectangle = {
  shape: 'rectangle';
  width: number;
  height: number;
};
type Shape = Square | Rectangle;
declare const SharedSquareObject: Shape;

export { type AppRouter, type Shape, SharedSquareObject };
