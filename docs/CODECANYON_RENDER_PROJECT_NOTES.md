# Codecanyon Render Project Notes

## Project Name

- Project: `codecanyon-render`
- Package name: `rideflow-render`
- Purpose: Render-oriented transformation of the original RideFlow package with a custom Node.js + PostgreSQL backend replacing the original Supabase-only runtime path.

## Working Paths

- Original package: `c:\Users\cored\Desktop\codecanyon`
- Active working clone: `c:\Users\cored\Desktop\codecanyon-render`

## Current Deployment Targets

- Local frontend: `http://localhost:8080`
- Local backend: `http://localhost:3000`
- Local health check: `http://localhost:3000/healthz`
- Render production URL: `https://codecanyon-render.onrender.com/`
- Render health check: `https://codecanyon-render.onrender.com/healthz`

## Current Architecture

- Frontend: React 18 + TypeScript + Vite
- Backend: Express on Node.js
- Database: PostgreSQL
- Client compatibility layer: `src/integrations/supabase/client.ts`
- Single-service Render deploy: frontend build served by backend when `dist/` is present

## Important Project Files

- App routing: `src/App.tsx`
- Route guards: `src/components/auth/RouteGuards.tsx`
- Setup guard: `src/components/setup/SetupGuard.tsx`
- Shared booking submission flow: `src/hooks/useBookingCheckout.ts`
- Render deploy config: `render.yaml`
- Local continuity summary: `CHAT_CONTINUITY_SUMMARY_2026-04-23.md`
- Flow map: `docs/CONVERSION_FLOW_MAP.md`
- Render backend deploy guide: `docs/RENDER_BACKEND_DEPLOY.md`

## Latest Verified Status

- Local PostgreSQL bootstrap was applied successfully.
- Local backend was verified against the intended local `DATABASE_URL`.
- Frontend build passes with `npm run build`.
- Route-level lane separation is in place for customer, driver, admin, and setup flows.
- Shared booking flow is now consolidated between `/` and `/book-now`.
- Account page no longer self-redirects while auth is resolving.
- Branding/logo navigation was fixed on auth, driver auth, setup, install, and homepage screens.
- Homepage splash screen was reduced to once per session so returning home does not feel like a black-screen lock.
- Render production home page responds successfully.
- Render `/healthz` responds with HTTP `200`.
- Customer bookings now resolve by `user_id` or `contact_email`, so guest-created bookings are visible after sign-in.
- `/track` now supports deep links via `?id=` and `?ref=` used by notification and booking actions.
- Booking confirmation email resend now falls back to the booking `contact_email` instead of requiring an active session.
- Local seed now creates deterministic admin, customer, driver, setup completion, and booking reference `DEMO-0001`.
- Render production now accepts the deterministic demo credentials for admin, customer, and driver lanes.
- Render production now has a real `drivers` row for `driver@demo.com` and a real booking `DEMO-0001` for `user@demo.com`.
- Render production `db/query` now prefers migrated `bookings` and `drivers` tables over legacy fallbacks, with legacy paths used only when the migrated tables are missing.
- Fleet catalog loaded in local and Render production with 12 active vehicles from the current medical transport roster.
- Booking now starts with no static fallback vehicle selected, so the live DB catalog drives what customers see in step 2.

## Current Route Intent

- Public/customer entry: `/`, `/book-now`, `/auth`, `/track`
- Customer protected pages: `/account`, `/my-bookings`
- Driver entry: `/driver/login`
- Driver protected page: `/driver`
- Admin entry: `/auth`
- Admin protected pages: `/admin` and all `/admin/*` routes
- Setup route: `/setup`

## Render Deployment Notes

- Render service name: `codecanyon-render`
- GitHub repo: `caremobilityservicesllc-cmyk/codecanyon-render`
- Active branch: `main`
- `render.yaml` is configured with `autoDeploy: true`
- Latest pushed deploy batch included route guard stabilization and navigation fixes

## Required Environment Variables

- `APP_URL`
- `DATABASE_URL`
- `RENDER_JWT_SECRET`
- `RENDER_AUTO_APPLY_SCHEMA`
- `VITE_RENDER_API_URL`
- `VITE_RENDER_STORAGE_URL`
- `VITE_RENDER_AUTH_STORAGE_KEY`
- `VITE_DEMO_MODE`

## Known Remaining Risks

- Not every admin, driver, and account click path has been manually exercised end-to-end in production.
- Some legacy compatibility surfaces still depend on fallback behavior for older table shapes.
- Large frontend bundle warnings remain during build, although they are warnings and not build failures.
- Full Supabase parity is still not complete for every original edge function and realtime behavior.

## Recommended Next Validation

1. Click-test production flows for `/account`, `/my-bookings`, `/admin`, `/driver`, and header/logo navigation.
2. Validate sign-in behavior separately for customer, admin, and driver lanes.
3. Verify booking creation, booking confirmation, and tracking on Render production.
4. Confirm Render environment variables match the current backend contract.

## Pending Deploy Batch

- No unpublished production-critical batch at this time.

## Latest Deploy Reference

- Latest pushed commit for the Render production validation batch: `296d0ba`
- Previous deploy reference: `aa90d061b616c8d8810717bfdbe12dfea06a4893`