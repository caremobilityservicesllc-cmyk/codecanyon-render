# Render Backend Deployment

This project now includes a Node.js backend in `backend/` for Render + PostgreSQL.

## What it provides now

- `POST /api/render/auth/sign-up`
- `POST /api/render/auth/sign-in`
- `POST /api/render/auth/sign-out`
- `POST /api/render/auth/update-user`
- `POST /api/render/auth/reset-password`
- `POST /api/render/db/query`
- `POST /api/render/functions/get_user_roles`
- `POST /api/render/functions/make_user_admin`
- `POST /api/render/functions/use_promo_code` (placeholder)

## Local setup

1. Create a PostgreSQL database.
2. Copy `.env.render.example` to `.env` or configure the same variables in your environment.
3. Run `npm run db:bootstrap`.
4. Run `npm run server`.
5. In another terminal, run `npm run dev` for the frontend.

## Render setup

For a single Render web service:

1. Set environment variables from `.env.render.example`.
2. Use build command: `npm install ; npm run build:render`
3. Use start command: `npm start`
4. Set `RENDER_AUTO_APPLY_SCHEMA=true` only for first boot or controlled schema updates.

The backend serves the built frontend from `dist/` when present, so you can deploy one service instead of splitting frontend and API.

## Current migration status

Completed:

- Replaced the frontend compatibility dependency on Supabase-only auth with a Render/Postgres backend contract.
- Added Postgres bootstrap SQL for core tables and roles.
- Added auth service and generic table query endpoint.
- Added initial RPC equivalents for `get_user_roles` and `make_user_admin`.

Still pending for full parity:

- OAuth providers
- Storage uploads and public file hosting
- Complex relational query support for all Supabase-style select strings
- Full port of all Supabase edge functions in `supabase/functions/`
- Realtime replacement for channels and subscriptions
- Full RLS-to-application-authorization rewrite