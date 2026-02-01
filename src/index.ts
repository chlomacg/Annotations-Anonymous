import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { appRouter } from './appRouter';
import { Session } from 'next-auth';
import cors from 'cors';

createHTTPServer({
  middleware: cors(),
  router: appRouter,
  createContext() {
    return { user: { id: '019c0fcc-c23a-7aaa-a2cf-af25fd3f301b' } };
  },
  // basePath: '/trpc/', // optional, defaults to '/'
}).listen(2000);
