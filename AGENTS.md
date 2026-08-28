# Project Guide

## Repository Layout

- `backend/`: NestJS backend.
- `backend/src/`: NestJS application source.
- `backend/src/app.module.ts`: Backend root module. TypeORM is configured here for app runtime with SQLite at `data/app.sqlite`.
- `backend/src/data-source.ts`: TypeORM CLI data source. Use this for migrations, not `app.module.ts` directly.
- `backend/src/dashbord/`: Dashboard module generated for the backend.
- `backend/src/dashbord/entities/`: Dashboard-related TypeORM entities, including `LogisticsOrder`.
- `backend/migrations/`: TypeORM migration files kept outside `src`.
- `backend/data/app.sqlite`: Local SQLite database file. It is runtime data and is ignored by Git.
- `frontend/`: Vue frontend.

## Backend Commands

Run backend commands from `backend/`.

- Install dependencies: `npm install`
- Build Nest app: `npm run build`
- Run unit tests: `npm test`
- Run lint: `npm run lint`
- Run migrations: `npm run migration:run`
- Revert last migration: `npm run migration:revert`

## Migration Notes

- Migrations live in `backend/migrations/`, outside `src`.
- Migration commands run TypeScript directly through `typeorm-ts-node-esm`.
- The TypeORM CLI entrypoint is `src/data-source.ts`.
- The migration data source points to `data/app.sqlite`; do not create a separate SQLite database for logistics data.
- The logistics CSV migration reads `/Users/jean/workspace/6-test/mock_logistics_data.csv` by default.
- Override the CSV path with `LOGISTICS_CSV_PATH=/path/to/file.csv npm run migration:run`.

## Current Data Model Scope

- `LogisticsOrder` belongs under `backend/src/dashbord/entities/`.
- The logistics table is `logistics_orders`.
- Do not add secondary indexes unless explicitly requested.
- `order_id` is unique so the migration can use `ON CONFLICT(order_id)` while importing rows.

## Git Expectations

- Do not commit code unless explicitly asked.
- Do not commit SQLite database files or generated `dist/` output.
- Treat existing uncommitted changes as user work unless asked to change them.
