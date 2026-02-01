Follow these steps to reproduce an (empty) database

1. `docker compose up -d`
2. `docker compose exec pg18 psql -U postgres AAdb`
3. #3 was to confirm we can log in. Ctrl+d to exit
4. `npm run migrate-latest`
