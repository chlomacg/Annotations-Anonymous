import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzledb } from './db'; // your drizzle instance
import * as schema from './db/schema';

export const auth = betterAuth({
  database: drizzleAdapter(drizzledb, {
    provider: 'pg',
    schema,
  }),

  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: ['http://localhost:5173'],

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      mapProfileToUser: async (profile) => {
        return { email: profile.email, name: profile.name };
      },
    },
  },
  //...other options
});
