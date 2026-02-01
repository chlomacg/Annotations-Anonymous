Follow these steps to reproduce an (empty) database

1. write a `.env` file with `POSTGRES_USER="your_username"` and `POSTGRES_PASSWORD="your_password"` on separate lines
2. `docker compose up -d`
3. `docker compose exec pg18 psql -U your_username AAdb`
4. #3 was to confirm we can log in. Ctrl+d to exit
5. `npm run migrate-latest`
