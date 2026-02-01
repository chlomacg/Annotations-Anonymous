Follow these steps to reproduce an empty database on localhost

1. write a `.env` file with `DATABASE_URL="postgresql://your_username:your_password@localhost:5432/AAdb"` `POSTGRES_USER="your_username"` and `POSTGRES_PASSWORD="your_password"` on separate lines
2. `docker compose up -d`
3. `docker compose exec pg18 psql -U your_username AAdb`
4. #3 was to confirm we can log in. Ctrl+d to exit
5. `npm run migrate-latest`

To populate the database with some debug data:
`npm run populate-debug-data`

To change the database schema:

1. modify `migrations/migration.ts`
2. `npm run migrate`
3. `npm run populate-debug-data` if it so pleases you
