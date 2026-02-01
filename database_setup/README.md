Follow these steps to reproduce an (empty) database

1. `cd ./database_setup`
2. `docker compose up -d`
3. `docker compose exec pg18 psql -U postgres AAdb`
4. #3 was to check if we can log in. Ctrl+d to exit
5. `docker compose exec -T pg18 psql -U postgres AAdb < initialize_database.sql`
