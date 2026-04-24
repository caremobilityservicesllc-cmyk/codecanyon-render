# RideFlow Render Transformation

This clone is the Render-oriented transformation of the original RideFlow package.

## What changed

- The project was copied into `codecanyon-render` to preserve the original package untouched.
- The package name was changed to `rideflow-render`.
- Environment variables now target Render-style endpoints instead of Supabase project keys.
- The original `src/integrations/supabase/client.ts` file was converted into a compatibility layer that keeps the existing frontend working against a custom backend.

## Compatibility layer behavior

The frontend still imports `supabase`, but the implementation now routes to Render endpoints:

- Auth -> `POST /api/render/auth/*`
- Data queries -> `POST /api/render/db/query`
- Server functions -> `POST /api/render/functions/:name`
- File uploads -> `POST /api/render/storage/upload`
- Public files -> `/api/render/storage/public/:bucket/:path`
- File deletion -> `POST /api/render/storage/remove`

## Backend endpoints you need on Render

### Auth

- `POST /api/render/auth/sign-in`
- `POST /api/render/auth/sign-up`
- `POST /api/render/auth/sign-out`
- `POST /api/render/auth/update-user`
- `POST /api/render/auth/reset-password`
- `GET /api/render/auth/oauth/:provider`

### Data

- `POST /api/render/db/query`

Expected payload shape:

```json
{
  "table": "bookings",
  "operation": "select",
  "select": "*",
  "filters": [{ "column": "id", "operator": "eq", "value": "..." }],
  "orderBy": [{ "column": "created_at", "ascending": false }],
  "limit": 20,
  "range": { "from": 0, "to": 19 },
  "single": false,
  "maybeSingle": false,
  "options": {}
}
```

Expected response shape:

```json
{
  "data": [],
  "count": 0,
  "error": null
}
```

### Functions

Implement Render handlers for the most-used Supabase functions:

- `process-payment`
- `auto-dispatch`
- `send-booking-email`
- `send-push-notification`
- `calculate-eta`
- `get-traffic-data`
- `predict-traffic`
- `predict-driver-deployment`
- `translate-batch`
- `send-sms`
- `process-refund`

## What is transformed vs pending

### Already transformed

- Project duplication into a Render-specific folder
- Render environment variables
- Render compatibility client for auth, DB, functions, and storage

### Still pending for a full migration

- Replace all Supabase SQL/RLS assumptions with your own backend authorization rules
- Replace Supabase realtime channels with polling, SSE, or WebSockets
- Port Supabase Edge Functions to your Render backend
- Port Supabase storage buckets to local object storage or S3-compatible storage
- Map `auth.users` and profile bootstrapping to your own user system

## Recommended migration order

1. Build a Render auth service and return session payloads compatible with the frontend.
2. Implement `/api/render/db/query` for the tables you need first: `bookings`, `drivers`, `vehicles`, `routes`, `zones`, `pricing_rules`, `system_settings`.
3. Port high-value functions: payment, dispatch, booking email, ETA, notifications.
4. Replace realtime booking tracking with polling or WebSocket updates.
5. Move uploads and public file URLs to your Render storage strategy.
