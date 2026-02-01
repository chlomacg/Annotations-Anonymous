import * as _trpc_server from '@trpc/server';

type User = {
  id: string;
};
type Context = {
  user: User | null;
};
declare const appRouter: _trpc_server.TRPCBuiltRouter<
  {
    ctx: Context;
    meta: object;
    errorShape: _trpc_server.TRPCDefaultErrorShape;
    transformer: false;
  },
  _trpc_server.TRPCDecorateCreateRouterOptions<{
    post: {
      interactions: {
        getStats: _trpc_server.TRPCQueryProcedure<{
          input: string;
          output: {
            postId: string;
            likes: number;
            reposts: number;
            replies: number;
          };
          meta: object;
        }>;
        byUser: _trpc_server.TRPCQueryProcedure<{
          input: string;
          output: {
            postId: string;
            liked: boolean;
            reposted: boolean;
          };
          meta: object;
        }>;
      };
      setLikeOnPost: _trpc_server.TRPCMutationProcedure<{
        input: {
          postId: string;
          likeState: boolean;
        };
        output: void;
        meta: object;
      }>;
      setRepost: _trpc_server.TRPCMutationProcedure<{
        input: {
          postId: string;
          repostState: boolean;
        };
        output: void;
        meta: object;
      }>;
    };
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
