# Bus Company API

![CI](https://github.com/zmkest/bus_company_api/actions/workflows/ci.yml/badge.svg)

REST API to manage an interprovincial bus company: fleet, routes and schedules, trips, crew, ticket sales and payments.

## Table of Contents

- [Features](#features)
- [Roles](#roles)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Documentation](#documentation)
- [License](#license)

## Features

- **Authentication and authorization**: login with JWT and refresh token in an HTTP-only cookie, role-based access control and password recovery.
- **User management**: create, update, activate / deactivate and list users with pagination and counters.
- **Fleet management**: register buses, track their status and odometer, and keep a full status history.
- **Seat maps**: define the physical seats of each bus.
- **Maintenance**: preventive and corrective maintenance linked to the bus status, with costs and history.
- **Network**: terminals, routes between cities and recurring schedules (frequencies) with base prices.
- **Trip planning**: automatic trip generation from schedules, bus validation and trip lifecycle (start, complete, cancel).
- **Crew management**: drivers and assistants, license control and assignment to trips.
- **Ticket sales**: seat reservation with expiration, counter sales, cancellation, boarding validation and ticket with QR code.
- **Payments**: cash, card and transfer payments, confirmation and refunds.
- **Reports**: sales, occupancy, profitable routes, fleet status and maintenance costs.

> Detailed feature checklist and progress: [docs/Features .md](<docs/Features .md>)

## Roles

| Role        | Description                                                                     |
| ----------- | ------------------------------------------------------------------------------- |
| `ADMIN`     | Full access: users, master data (fleet, network, pricing), refunds and reports  |
| `OPERATOR`  | Daily operations: trips, rotations, crew assignment, bus status and maintenance |
| `SELLER`    | Counter sales: passengers, tickets, payments and own cash closing               |
| `DRIVER`    | Own assigned trips: start / complete, passenger manifest and boarding           |
| `PASSENGER` | Searches trips, buys and manages own tickets and payments                       |

Some endpoints are `Public` (no authentication: register, login, trip search, cities) and some features are `System` rules or scheduled jobs without an endpoint of their own.

### Permissions matrix

| Module               | `ADMIN` | `OPERATOR` | `SELLER` | `DRIVER` | `PASSENGER` |
| -------------------- | ------- | ---------- | -------- | -------- | ----------- |
| Users                | Full    | —          | —        | —        | —           |
| Buses and seats      | Full    | Operate    | Read     | —        | —           |
| Maintenance          | Full    | Operate    | —        | —        | —           |
| Terminals and routes | Full    | Read       | Read     | —        | —           |
| Frequencies          | Full    | Read       | —        | —        | —           |
| Trips and rotations  | Full    | Full       | Read     | Own      | —           |
| Crew                 | Full    | Operate    | —        | Own      | —           |
| Passengers           | Full    | —          | Full     | —        | Own         |
| Tickets              | Full    | Board      | Full     | Board    | Own         |
| Payments             | Full    | —          | Own      | —        | Own         |
| Reports              | Full    | Operations | —        | —        | —           |

- **Full**: create, read, update and delete. **Read**: query only.
- **Operate**: daily operations without changing master data (status, assignments, maintenance).
- **Own**: only over their own resources. **Board**: validate and board tickets.
- **Operations**: operational reports only (trips and delays, fleet status, maintenance cost).

Detailed role per endpoint: [docs/Features .md](<docs/Features .md>)

## Tech Stack

| Area       | Technology                                          |
| ---------- | --------------------------------------------------- |
| Framework  | NestJS + TypeScript                                 |
| ORM        | Prisma                                              |
| Database   | PostgreSQL (hosted on Supabase)                     |
| Auth       | JWT (`@nestjs/jwt`), `bcrypt` for password hashing  |
| Validation | `class-validator`, `class-transformer`, `joi` (env) |
| Tooling    | pnpm, GitHub Actions (CI)                           |
| Mail       | Resend                                              |

## Getting Started

### Prerequisites

- Node.js v24.18 or higher
- pnpm v11.14 or higher
- A [Supabase](https://supabase.com) account

### 1. Set up the database (Supabase)

1. Create a new project.
2. Save the project's database password.
3. Copy the connection string (`DATABASE_URL`). You will need it in step 4.

### 2. Clone and install

```bash
git clone https://github.com/zmkest/bus_company_api.git
cd bus_company_api
pnpm install
```

### 3. Configure environment variables

```bash
cp .env.template .env
```

Fill in the values described in [Configuration](#configuration).

### 4. Prepare the database

```bash
pnpm prisma generate
pnpm prisma migrate dev

# Optional: seed the database
pnpm prisma db seed
```

### 5. Start the app

```bash
pnpm start:dev
```

## Configuration

### Environment Variables

**General**

| Variable       | Description                  |
| -------------- | ---------------------------- |
| `PORT`         | Port where the server runs   |
| `DATABASE_URL` | PostgreSQL connection string |
| `FRONTEND_URL` | Frontend base URL            |

**Authentication tokens**

| Variable             | Description                   |
| -------------------- | ----------------------------- |
| `JWT_SECRET`         | Secret to sign access tokens  |
| `JWT_REFRESH_SECRET` | Secret to sign refresh tokens |

**Password setup token** (first password of a user created by an admin)

| Variable                 | Description                 |
| ------------------------ | --------------------------- |
| `JWT_PWD_SETUP_SECRET`   | Secret to sign the token    |
| `JWT_PWD_SETUP_PURPOSE`  | Purpose claim of the token  |
| `JWT_PWD_SETUP_ISSUER`   | Issuer claim of the token   |
| `JWT_PWD_SETUP_AUDIENCE` | Audience claim of the token |

**Password reset token**

| Variable                 | Description                 |
| ------------------------ | --------------------------- |
| `JWT_PWD_RESET_SECRET`   | Secret to sign the token    |
| `JWT_PWD_RESET_PURPOSE`  | Purpose claim of the token  |
| `JWT_PWD_RESET_ISSUER`   | Issuer claim of the token   |
| `JWT_PWD_RESET_AUDIENCE` | Audience claim of the token |

**Send mail**

| Variable         | Description                |
| ---------------- | -------------------------- |
| `RESEND_API_KEY` | Secret resend key          |
| `RESEND_EMAIL`   | Email with verified domain |

## Scripts

| Command           | Description          |
| ----------------- | -------------------- |
| `pnpm start`      | Run in development   |
| `pnpm start:dev`  | Run in watch mode    |
| `pnpm start:prod` | Run in production    |
| `pnpm test`       | Run unit tests       |
| `pnpm test:e2e`   | Run end-to-end tests |

## Documentation

- [Feature checklist](<docs/Features .md>): progress by module
- [Solved problems](docs/tickets.md): practical cases and solutions

## License

MIT
