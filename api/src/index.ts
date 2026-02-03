import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { appRouter } from './appRouter';
import cors from 'cors';

createHTTPServer({
  middleware: cors(),
  router: appRouter,
  createContext() {
    return { user: { id: '019c1b31-7ad1-7a6d-aafa-7d31aebd4547' } };
  },
  // basePath: '/trpc/', // optional, defaults to '/'
}).listen(2000);
