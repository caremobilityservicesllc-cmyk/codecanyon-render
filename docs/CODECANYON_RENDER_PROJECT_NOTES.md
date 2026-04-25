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
- Driver roster loaded from the `LICENCE/` folder into local and Render production with 22 records using license-based imports.
- Driver auth accounts provisioned in local and Render production for the imported roster using capitalized first-name usernames.
- Driver usernames and phones from the provided user-directory screenshots were synced for the matching imported drivers in local and Render production.
- Backend auth now accepts either `auth_users.email` or `auth_users.metadata->>'username'` at sign-in, so admin and driver logins can use username-based credentials.
- Booking now starts with no static fallback vehicle selected, so the live DB catalog drives what customers see in step 2.
- Local hotfix build now removes the Vite PWA app-shell registration and clears stale service workers/cache storage on startup to prevent post-deploy black/black-screen states from stale cached bundles.

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
- Latest pushed deploy batch included auth and driver migration fixes; the current pending hotfix is focused on stale cached frontend bundles causing black-screen behavior after deploys.

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

- PWA/cache hotfix in `vite.config.ts` and `src/main.tsx` to disable stale app-shell registration and clear old service workers/caches on startup.
- No raw `LICENCE/` image files are required for deployment; the import scripts already contain the normalized driver dataset.

## Latest Data Import

- 2026-04-24: Imported 22 drivers from the local `LICENCE/` folder into local PostgreSQL and Render production.
- Import method: `backend/scripts/import-licence-drivers.js`
- Safety defaults: imported drivers are `is_active=true` and `is_available=false` until phone/onboarding data is completed.
- 2026-04-24: Provisioned 22 driver login accounts in local and Render production with `backend/scripts/provision-driver-logins.js`.
- Login rule: username is the driver first name capitalized; password is `Name@NN`, currently `NN=00` where phone digits are still missing.
- 2026-04-24: Synced 16 driver usernames/phones from the supplied screenshots with `backend/scripts/sync-driver-directory-details.js` and `backend/scripts/driver-directory-overrides.js`.
- Updated logins now use the supplied usernames where available, with passwords regenerated as `username@lastTwoPhoneDigits`.
- Remaining imported drivers without screenshot phone data still keep the placeholder `@00` suffix until their numbers are provided.

## Latest Deploy Reference

- Latest pushed commit for the auth and driver migration validation batch: `587773d901760f96ce95de4882a3978489351596`
- Current pending hotfix before next Render deploy: disable stale PWA registration and purge stale service worker/cache state on app startup.
- Previous deploy reference: `296d0ba`