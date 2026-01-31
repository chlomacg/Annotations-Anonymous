import { initTRPC } from "@trpc/server";
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { appRouter, createContext } from "./appRouter";
import { Session } from "next-auth";

createHTTPServer({
  router: appRouter,
  createContext,
  // basePath: '/trpc/', // optional, defaults to '/'
}).listen(2000);
