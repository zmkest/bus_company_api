## Features

> **Roles legend**: each item ends with the role(s) that should consume it.
>
> - `ADMIN` `OPERATOR` `SELLER` `DRIVER` `PASSENGER`: user roles
> - `Public`: no authentication
> - `Authenticated`: any logged-in user
> - `System`: internal rule or scheduled job (no endpoint of its own)
> - `(own)`: only over their own resources (e.g. a driver's assigned trips)
> - `(actual: ...)`: roles currently in the code when they differ from the target; to be fixed in **Roles and endpoint authorization**

- [x] **Authentication**
  - [x] RolesGuard and `@Roles()` decorator — `System`
  - [x] Register — `Public`
  - [x] Login with JWT (refresh token in HTTP-only cookie) — `Public`
  - [x] Refresh token — `Public`
  - [x] Logout (clear cookie) — `Public`
  - [x] JWT guard (attach user to request) — `System`
  - [x] User is active — `System`
  - [x] Change password — `Authenticated`
  - [x] Forgot password — `Public`
  - [x] Reset password — `Public`
  - [x] Get current user profile (`/auth/me`) — `Authenticated`
  - [x] Invalidate refresh token on logout, password change and password reset (`refreshTokenHash = null`) — `System`
  - [x] Rate limiting on login / forgot password (anti brute-force) — `System`

- [x] **Users**
  - [x] Create user — `ADMIN`
  - [x] Update user — `ADMIN`
  - [x] Update user status — `ADMIN`
  - [x] Get users (paginated) — `ADMIN`
  - [x] Get user by id — `ADMIN` (actual: Authenticated)
  - [x] Delete user by id — `ADMIN`
  - [x] Count users — `ADMIN`
  - [x] Count users by status — `ADMIN`

- [x] **Buses**
  - [x] Create bus — `ADMIN`
  - [x] Get buses (paginated) — `ADMIN` `OPERATOR` (actual: ADMIN)
  - [x] Get bus by id — `ADMIN` `OPERATOR` (actual: ADMIN)
  - [x] Update bus by id — `ADMIN` `OPERATOR`
  - [x] Delete bus by id — `ADMIN`
  - [x] Count buses — `ADMIN` `OPERATOR` (actual: ADMIN)
  - [x] Count buses by status — `ADMIN` `OPERATOR` (actual: ADMIN)
  - [x] Update bus status — `ADMIN` `OPERATOR`
    - [x] Save change in status history — `System`
    - [x] Create maintenance when status is `MAINTENANCE` — `System`
  - [x] Get available buses (status `AVAILABLE` and no overlapping trip in a given date range) — `ADMIN` `OPERATOR`
  - [x] Update odometer (`odometerKm`, cannot decrease) — `ADMIN` `OPERATOR`
  - [x] Block deletion if bus has trips, maintenances or status history (use `OUT_OF_SERVICE` instead) — `System`
  - [x] Validate maintenance dates (temporal consistency) `/buses/:id/status` — `System`
    - [x] Add optional `maintenanceId` FK to `BusStatusHistory` (nullable, `ON DELETE RESTRICT`)
    - [x] Set `maintenanceId` on history records created by start / complete / cancel
    - [x] Start: `startedAt` >= last `BusStatusHistory.createdAt` and <= now
    - [x] Start: reject if bus has trips on or after `startedAt`
    - [x] Complete: `startedAt` <= `finishedAt` <= now
    - ~~[ ] Complete: reject if bus has trips between `startedAt` and `finishedAt`~~
    - [x] Block bus status changes while a maintenance is open (only complete/cancel)
    - [x] Lock bus row (`pessimistic_write`) inside transaction to avoid race conditions
    - [x] Return 422 with clear message on violation
    - [x] Frontend: date pickers with `min`/`max` based on last change and today
    - [x] Document: history = audit log (`createdAt`), Maintenance = real dates
  - [x] **Status History**
    - [x] Get status history (paginated) — `ADMIN` `OPERATOR`
    - [x] Get status history by id — `ADMIN` `OPERATOR`
    - [x] Count status history by toStatus — `ADMIN` `OPERATOR`
  - [x] **Seats**
    - [x] Create seats by busId (bulk: total seats, numbered 1..N) — `ADMIN` (actual: ADMIN, OPERATOR)
    - [x] Delete seats by id (block if seat has active tickets) — `ADMIN` (actual: ADMIN, OPERATOR)
    - [x] Update seat if it is operational — `ADMIN` `OPERATOR`
    - [x] Get seats (paginated, filter by bus plate) — `ADMIN` `OPERATOR` (actual: ADMIN, OPERATOR, SELLER)
    - [x] Get seats by busId (seat map) — `ADMIN` `OPERATOR` `SELLER`
  - [x] **Maintenance**
    - [x] Add status on maintenance (IN-PROGRESS, COMPLETED, CANCELLED) — `System`
    - [x] Update maintenance (cost, finishedAt) — `ADMIN` `OPERATOR`
    - [x] Update and complete maintenance (update bus, create history) — `ADMIN` `OPERATOR`
    - [x] Update and cancel maintenance (update bus, create history) — `ADMIN` `OPERATOR`
    - ~~[ ] Delete maintenance (cascade delete related records)~~
    - [x] Get maintenances (paginated, filter by plate, startedAt, finishedAt, type), return busPlate in object — `ADMIN` `OPERATOR` (actual: ADMIN, OPERATOR, DRIVER)
    - [x] Get maintenance by id — `ADMIN` `OPERATOR`
    - [x] Count maintenances by status / type — `ADMIN` `OPERATOR`
    - [x] Get maintenance cost report by bus and date range — `ADMIN` (actual: ADMIN, OPERATOR)
    - ~~[ ] Create preventive maintenance manually (without changing bus status)~~
    - [x] Block updates on final maintenances (`COMPLETED` / `CANCELLED`) — `System`
      - [x] Reject changes to `status`, `startedAt`, `finishedAt`, `busId`, `type` (409)
      - [x] Allow only informative fields (`notes`, `cost`) — `ADMIN`
      - [x] Remove `status` from generic update DTO (transitions only via complete/cancel)
      - [x] Complete/cancel endpoints reject already-final maintenances (409)

- [x] **Terminals**
  - [x] Create terminal — `ADMIN` (actual: ADMIN, OPERATOR)
  - [x] Get terminals (paginated, filter by city / name) — `ADMIN` `OPERATOR` `SELLER` (actual: ADMIN, OPERATOR)
  - [x] Get terminal by id — `ADMIN` `OPERATOR` `SELLER` (actual: ADMIN, OPERATOR)
  - [x] Update terminal by id — `ADMIN`
  - [x] Delete terminal by id (block if used by routes) — `ADMIN`
  - [x] Get cities list (distinct, for search selectors) — `Public`

- [x] **Routes**
  - [x] Create route (origin ≠ destination, unique pair) — `ADMIN`
  - [x] Get routes (paginated, filter by origin / destination city) — `ADMIN` `OPERATOR` `SELLER` (actual: ADMIN, OPERATOR)
  - [x] Get route by id (includes terminals and frequencies) — `ADMIN` `OPERATOR` `SELLER` (actual: ADMIN, OPERATOR)
  - [x] Update route by id (distance, duration) — `ADMIN`
  - [x] Delete route by id (block if it has frequencies or trips) — `ADMIN`
  - [x] Search routes by origin and destination city — `Public`

- [x] **Frequencies (schedules)**
  - [x] Create frequency (route, departure time, weekdays, base price) — `ADMIN`
  - [x] Get frequencies (paginated, filter by route, weekday, active) — `ADMIN` `OPERATOR`
  - [x] Get frequency by id — `ADMIN` `OPERATOR`
  - [x] Update frequency by id — `ADMIN`
  - [x] Activate / deactivate frequency — `ADMIN`
  - [x] Delete frequency by id (trips keep history, `frequencyId` → null) — `ADMIN`
  - [x] Validate no duplicated frequency (same route, time and weekdays) — `System`

- [ ] **Trips**
  - [x] Create trip manually (route, bus, departure, price) — `ADMIN` `OPERATOR`
  - [x] Generate trips from frequencies (date range, skips existing: `frequencyId + scheduledDeparture`) — `ADMIN` `OPERATOR`
  - [x] Get trips (paginated, filter by route, bus plate, status, date range) — `ADMIN` `OPERATOR` `SELLER` (actual: ADMIN, OPERATOR)
  - [x] Search available trips (origin, destination, date, seats left) — `Public`
  - [x] Get trip by id (includes route, bus, crew, seats left) — `ADMIN` `OPERATOR` `SELLER` (actual: ADMIN, OPERATOR)
  - [x] Update trip (reschedule, change bus or price) only if `SCHEDULED` — `ADMIN` `OPERATOR`
  - [x] Validate bus availability (status `AVAILABLE` and no overlapping trips, considering route duration) — `System`
  - [x] Rotations: weekly bus cycle over frequencies, auto-assign bus on generate, change rotation bus (`applyFrom`) — `ADMIN` `OPERATOR`
  - [x] Start trip (`IN_PROGRESS`, set `actualDeparture`, bus → `ON_ROUTE`, save history) — `ADMIN` `OPERATOR` `DRIVER (own)`
  - [x] Complete trip (`COMPLETED`, set `actualArrival`, bus → `AVAILABLE`, update `odometerKm` with route distance) — `ADMIN` `OPERATOR` `DRIVER (own)`
  - [x] Get seat map of a trip (seat number + status: free / reserved / sold, no passenger data) — `Public`
  - [x] Get passenger manifest of a trip (boarding list) — `ADMIN` `OPERATOR` `DRIVER (own)`
  - [x] Count trips by status — `ADMIN` `OPERATOR`
  - [x] Get my assigned trips — `DRIVER`
  - [ ] Cancel trip (`CANCELLED`, cancel tickets, refund payments, free bus) — `ADMIN` `OPERATOR`

- [ ] **Crew**
  - [ ] Create crew member (document, name, position, license; optional link to user) — `ADMIN`
  - [ ] Get crew members (paginated, filter by position, status, name / document) — `ADMIN` `OPERATOR`
  - [ ] Get crew member by id — `ADMIN` `OPERATOR`
  - [ ] Update crew member by id — `ADMIN`
  - [ ] Update crew member status (`ACTIVE`, `INACTIVE`, `SUSPENDED`) — `ADMIN` `OPERATOR`
  - [ ] Delete crew member by id (block if assigned to trips) — `ADMIN`
  - [ ] Validate license for `DRIVER` (number required and not expired) — `System`
  - [ ] Get crew members with licenses expiring soon (alert, e.g. 30 days) — `ADMIN` `OPERATOR`
  - [ ] Get available crew members for a date range — `ADMIN` `OPERATOR`
  - [ ] **Trip crew assignment**
    - [ ] Assign crew to trip (at least 1 `DRIVER`, only `ACTIVE`, no overlapping trips) — `ADMIN` `OPERATOR`
    - [ ] Remove crew from trip (only if trip is `SCHEDULED`) — `ADMIN` `OPERATOR`
    - [ ] Get crew of a trip — `ADMIN` `OPERATOR` `DRIVER (own)`
    - [ ] Get trip history by crew member — `ADMIN` `OPERATOR`

- [ ] **Passengers**
  - [ ] Create passenger (document, name, email, phone) — `ADMIN` `SELLER`
  - [ ] Find or create passenger by document (used on ticket sale) — `System`
  - [ ] Get passengers (paginated, filter by name / document) — `ADMIN` `SELLER`
  - [ ] Get passenger by id — `ADMIN` `SELLER`
  - [ ] Update passenger by id — `ADMIN` `SELLER`
  - [ ] Delete passenger by id (block if has tickets) — `ADMIN`
  - [ ] Get passenger travel history (tickets) — `ADMIN` `SELLER`
  - [ ] Get my profile and my tickets — `PASSENGER`

- [ ] **Tickets**
  - [ ] Reserve seat (status `RESERVED`, set `expiresAt`; trip must be `SCHEDULED`) — `SELLER` `PASSENGER (own)`
  - [ ] Sell ticket directly (counter: ticket `PAID` + payment `COMPLETED` in one transaction) — `ADMIN` `SELLER`
  - [ ] Prevent double booking (no 2 active tickets for the same `tripId + seatId`, DB partial unique index) — `System`
  - [ ] Validate seat belongs to the trip's bus — `System`
  - [ ] Get tickets (paginated, filter by trip, passenger, status, date range) — `ADMIN` `SELLER`
  - [ ] Get ticket by id / by `code` — `ADMIN` `SELLER` `DRIVER` `PASSENGER (own)`
  - [ ] Pay reserved ticket (`RESERVED` → `PAID`) — `SELLER` `PASSENGER (own)`
  - [ ] Expire unpaid reservations (scheduled job, `RESERVED` → `CANCELLED` when `expiresAt` passes) — `System`
  - [ ] Cancel ticket (free the seat, refund if paid, per cancellation policy) — `ADMIN` `SELLER` `PASSENGER (own)`
  - [ ] Change seat or trip on a ticket (only if `RESERVED` / `PAID`) — `ADMIN` `SELLER`
  - [ ] Board passenger (validate `code`, `PAID` → `BOARDED`, only if trip is `IN_PROGRESS` or about to depart) — `ADMIN` `OPERATOR` `DRIVER (own)`
  - [ ] Generate ticket PDF with QR code (from `code`) — `ADMIN` `SELLER` `PASSENGER (own)`
  - [ ] Send ticket by email — `ADMIN` `SELLER` `PASSENGER (own)`
  - [ ] Count tickets by status — `ADMIN`
  - [ ] Get tickets sold by seller (`soldById`) — `ADMIN` `SELLER (own)`

- [ ] **Payments**
  - [ ] Register payment for ticket (method `CASH`, `CARD`, `TRANSFER`) — `SELLER` `PASSENGER (own)`
  - [ ] Validate amount matches ticket price (no overpayment) — `System`
  - [ ] Confirm pending payment (`PENDING` → `COMPLETED`, e.g. transfer verification) — `ADMIN` `SELLER`
  - [ ] Refund payment (`COMPLETED` → `REFUNDED`, cancel ticket) — `ADMIN` `SELLER`
  - [ ] Get payments (paginated, filter by method, status, date range) — `ADMIN` `SELLER (own)`
  - [ ] Get payment by id — `ADMIN` `SELLER (own)`
  - [ ] Get payments by ticket — `ADMIN` `SELLER` `PASSENGER (own)`
  - [ ] Daily cash closing by seller (totals by method) — `ADMIN` `SELLER (own)`

- [ ] **Reports and Dashboard**
  - [ ] Sales by date range (total, by route, by seller, by payment method) — `ADMIN`
  - [ ] Occupancy rate by trip / route — `ADMIN`
  - [ ] Most profitable routes — `ADMIN`
  - [ ] Trips by status and delay (`scheduledDeparture` vs `actualDeparture`) — `ADMIN` `OPERATOR`
  - [ ] Fleet status summary (buses by status) — `ADMIN` `OPERATOR`
  - [ ] Maintenance cost by bus — `ADMIN` `OPERATOR`
  - [ ] Export reports (CSV / Excel) — `ADMIN`

- [ ] **Roles and endpoint authorization**
  - [x] Document target role per endpoint (this file + README permissions matrix)
  - [ ] Apply target roles on existing endpoints (every item marked `(actual: ...)`)
  - [ ] Restrict `GET /user/:id` to `ADMIN` (self profile via `/auth/me`)
  - [ ] Ownership checks for `(own)` (DRIVER assigned trips, PASSENGER own tickets / payments, SELLER own sales)
  - [ ] e2e tests of the permissions matrix (allowed and forbidden role per endpoint)

- [ ] **Cross-cutting**
  - [ ] Global validation (DTOs with `class-validator`) and exception filter — `System`
  - [ ] Standard pagination, sorting and filtering helper — `System`
  - [ ] Role permissions matrix (ADMIN, OPERATOR, SELLER, DRIVER, PASSENGER) — see **Roles and endpoint authorization**
  - [ ] Audit log for critical actions (sales, refunds, cancellations) — `System`
  - [ ] Soft delete / history preservation for records with relations — `System`
  - [ ] Swagger / OpenAPI documentation — `Public`
  - [ ] Seed script (admin user, terminals, routes, buses with seats) — `System`
  - [ ] Unit and e2e tests for critical flows (sell ticket, cancel trip) — `System`
  - [ ] Health check endpoint and structured logging — `Public`
