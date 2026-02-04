Requires docker.

To set up a local dev environment:
`npm run setup`

Then you can `npm run dev` here or at the project root (change the postgres credentials in .env first if you like)

Should you modify the schema via `src/db/schema.ts` and/or modify the debug data via `scripts/populateDebugData.ts`, restart the database with:
`npm run rebuild-debug-db`
