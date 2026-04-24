# RideFlow Conversion Flow Map

## Purpose

This map defines the real application flow that the Render conversion must support before further bug-fixing.

The app has 3 independent entry lanes:

1. Customer lane
2. Driver lane
3. Admin lane

It also has 1 shared operational lane:

1. Booking lifecycle lane

## Current Route Map

### Public routes

- `/` homepage with embedded booking wizard
- `/book-now` dedicated booking wizard page
- `/auth` customer and admin sign-in/sign-up page
- `/driver/login` driver sign-in/sign-up page
- `/track` booking lookup by booking reference and email
- `/booking-confirmation/:id` booking confirmation page
- `/contact`
- `/features`
- `/terms`
- `/privacy`
- `/install`
- `/page/:slug`

### Setup route

- `/setup` initial application launch wizard

### Admin routes

- `/admin`
- `/admin/bookings`
- `/admin/customers`
- `/admin/drivers`
- `/admin/document-review`
- `/admin/driver-applications`
- `/admin/vehicles`
- `/admin/notifications`
- `/admin/zones`
- `/admin/routes`
- `/admin/pricing`
- `/admin/promo-codes`
- `/admin/calculator`
- `/admin/settings`
- `/admin/scheduling`
- `/admin/revenue`
- `/admin/pages`

### Driver routes

- `/driver`

## Flow Diagram

```mermaid
flowchart TD
    A[Visitor enters site] --> B{Entry lane}

    B --> C[Customer lane]
    B --> D[Driver lane]
    B --> E[Admin lane]

    C --> C1[/ or /book-now]
    C --> C2[/auth]
    C --> C3[/track]

    C1 --> C4[Step 1 pickup and dropoff]
    C4 --> C5[Step 2 vehicle selection]
    C5 --> C6[Step 3 payment method]
    C6 --> C7[Create booking row]
    C7 --> C8[Process payment]
    C8 --> C9[Auto-dispatch attempt]
    C9 --> C10[Send booking email]
    C10 --> C11[/booking-confirmation/:id]
    C11 --> C12[/track by reference and email]

    C2 --> C13[Customer or admin credentials]
    C13 --> C14{Role check}
    C14 -->|user| C15[/my-bookings and /account]
    C14 -->|admin| E1[/admin]

    D --> D1[/driver/login]
    D1 --> D2[Auth sign-in]
    D2 --> D3[Lookup drivers by user_id]
    D3 -->|driver row exists| D4[/driver dashboard]
    D3 -->|missing driver row| D5[Driver blocked]

    E --> E0[/auth]
    E0 --> E1[/admin]
    E1 --> E2[AdminLayout]
    E2 --> E3[useUserRoles RPC get_user_roles]
    E3 -->|admin| E4[Admin sections]
    E3 -->|not admin| E5[Redirect to home]

    E4 --> E6[Bookings]
    E4 --> E7[Customers]
    E4 --> E8[Drivers]
    E4 --> E9[Vehicles]
    E4 --> E10[Routes and zones]
    E4 --> E11[Pricing and promo codes]
    E4 --> E12[Settings and pages]

    E6 --> F[Booking lifecycle lane]
    C7 --> F
    D4 --> F

    F --> F1[pending]
    F1 --> F2[confirmed]
    F2 --> F3[driver assigned]
    F3 --> F4[driver live tracking]
    F4 --> F5[completed]
    F5 --> F6[rating and earnings]
```

## Intended Target Flow

### Customer lane

1. Visitor lands on `/` or `/book-now`.
2. Visitor can complete a booking without needing admin or driver flow.
3. Booking creates a `bookings` row with reference, email, pricing, vehicle, and status.
4. Customer receives booking email.
5. Customer can later sign in at `/auth` to see `/my-bookings` and `/account`.
6. Customer can also use `/track` without login by booking reference plus email.

### Driver lane

1. Driver enters only through `/driver/login`.
2. Successful auth must map to exactly one `drivers.user_id` row.
3. Driver sees only `/driver` functionality.
4. Driver can view assigned trips, shifts, documents, payout, availability, and live notifications.
5. Driver must never be redirected through admin flow.

### Admin lane

1. Admin enters through `/auth`.
2. Successful auth must resolve `admin` role from `get_user_roles`.
3. Admin lands on `/admin`.
4. Admin controls bookings, customers, drivers, pricing, dispatch, settings, notifications, pages, and operational monitoring.
5. Admin must never be routed through driver checks.

### Booking lifecycle lane

1. Booking created by customer.
2. Payment processed or marked pending.
3. Booking dispatch attempted.
4. Driver assigned.
5. Customer tracking enabled.
6. Status notifications and emails sent.
7. Driver completes ride.
8. Admin can review revenue, notifications, and audit history.

## Structural Problems Found In Current Conversion

### 1. Setup gate is global enough to distort flow

`SetupGuard` wraps the route tree and can redirect navigation into `/setup` before role-specific flow settles.

Impact:

- back navigation can feel broken
- user can bounce into setup unexpectedly
- freezing and black screens become harder to reason about

### 2. Router does not declare role guards at the route level

`App.tsx` exposes admin and driver routes directly. Protection happens later inside page/layout logic.

Impact:

- route transitions are inconsistent
- blank states happen after route load instead of before route entry
- back button can land in a route the current user should never have entered

### 3. Customer and admin share `/auth`

This is valid only if post-login role routing is deterministic.

Impact:

- any failure in `get_user_roles` sends admin into the wrong lane
- customer and admin UX are coupled too tightly during conversion

### 4. Driver lane depends on `drivers.user_id` existing

Driver auth succeeds first, then the app checks for a linked `drivers` row.

Impact:

- driver can log in but still be denied dashboard access
- migration must guarantee that every driver auth record maps to a driver profile

### 5. Booking flow exists in 2 places

The booking wizard logic is duplicated in `/` and `/book-now`.

Impact:

- one flow can break while the other still works
- bug fixes must be duplicated
- conversion drift becomes likely

### 6. Tracking depends on booking reference plus contact email matching exactly

`/track` requires exact reference and exact normalized email.

Impact:

- imported legacy bookings can be invisible to customers if email/reference normalization differs

### 7. Email, dispatch, payment, and notifications are chained but loosely guarded

Booking creation, payment, auto-dispatch, and email are handled in sequence with partial fallbacks.

Impact:

- booking may exist while email, payment, or dispatch only partially completes
- admin sees inconsistent state unless each step is observable in logs and status fields

## Required Migration Order

Do not continue fixing random screens before this order is stabilized.

1. Stabilize route guards and lane separation.
2. Normalize auth mapping for customer, driver, and admin.
3. Consolidate customer booking flow into one shared booking engine.
4. Stabilize booking lifecycle status transitions.
5. Verify tracking, email, dispatch, and driver assignment.
6. Only then fix individual admin pages.

## Minimum Technical Checklist

- `SetupGuard` must not trap authenticated users in the wrong lane.
- Route-level guards should exist for customer, driver, and admin lanes.
- Driver sign-in must validate both auth identity and linked driver profile.
- Admin sign-in must validate role before rendering admin routes.
- Customer booking flow should be shared between `/` and `/book-now`.
- Booking creation should always produce reference, contact email, and visible status.
- Email logging should capture success or failure.
- Dispatch logging should capture assignment attempts and failures.
- Tracking should work for imported legacy and new converted bookings.

## Immediate Next Engineering Phase

Phase 1 should implement lane separation:

1. Public lane guard
2. Customer account guard
3. Driver-only guard
4. Admin-only guard
5. Setup guard that runs before launch only, not as a permanent blocker

After that, Phase 2 should extract one shared booking workflow used by homepage and book-now page.