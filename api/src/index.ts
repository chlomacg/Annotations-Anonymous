import * as trpcExpress from '@trpc/server/adapters/express';
import express from 'express';
import cors from 'cors';
import { toNodeHandler } from 'better-auth/node';
import { appRouter, createContext } from './appRouter';
import { auth } from './auth';

const port = 4000;

const app = express();

const whitelist = [`http://localhost:5173`, `http://localhost:5174`];
const authCorsOptions: cors.CorsOptions = {
  credentials: true, // This is important.
  origin: whitelist,
  allowedHeaders: ['Access-Control-Allow-Origin', 'Content-Type'],
};

app.use(
  '/trpc',
  cors(),
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.all('/api/auth/{*any}', cors(authCorsOptions), toNodeHandler(auth));

app.listen(port, () => {
  console.log(`TRPC and better auth listening on port ${port}`);
});
