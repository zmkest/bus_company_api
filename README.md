# Bus Company Backend

![CI](https://github.com/zmkest/bus_company_api/actions/workflows/ci.yml/badge.svg)

A backend API for managing bus trips, ticket sales, and seat allocation.

## Features

- [ ] **Authentication**
  - [x] RolesGuard and `@Roles()` decorator
  - [x] Register
  - [x] Login with JWT (refresh token in HTTP-only cookie)
  - [x] Refresh token
  - [x] Logout (clear cookie)
  - [x] JWT guard (attach user to request)
  - [x] User is active
  - [ ] Change password
  - [ ] Forgot password
  - [ ] Reset password

- [x] **Users**
  - [x] Create user (ADMIN)
  - [x] Update user (ADMIN)
  - [x] Update user status (ADMIN)
  - [x] Get users (paginated)
  - [x] Get user by id
  - [x] Delete user by id
  - [x] Count users
  - [x] Count users by status

- [ ] **Buses**
  - [x] Create bus (ADMIN)
  - [x] Get buses (paginated, ADMIN)
  - [x] Get bus by id
  - [x] Update bus by id
  - [x] Delete bus by id
  - [x] Count buses
  - [x] Count buses by status
  - [x] Update bus status
    - [x] Save change in status history
    - [x] Create maintenance when status is `MAINTENANCE`
  - [x] **Status History**
    - [x] Get status history (paginated)
    - [x] Get status history by id
  - [ ] **Seats**
    - [ ] Create seats by busId
    - [ ] Delete seats by id
    - [ ] Get seats (paginated, filter by bus plate)
  - [ ] **Maintenance**
    - [ ] Update maintenance (cost, finishedAt)
    - [ ] Delete maintenance (cascade delete related records)
    - [ ] Get maintenances (paginated, filter by plate, startedAt, finishedAt, type)

## Tech Stack

- NestJS v12
- Node.js v24.18
- pnpm v11.14

## Third-party Dependencies

- Prisma (ORM)
- Supabase (PostgreSQL database)
- class-validator class-transformer
- @nestjs/jwt (token)
- bcrypt (Encript)
- joi (validation env)

## Prerequisites

- Node.js v24.18 or higher
- pnpm v11.14 or higher
- A Supabase account

## Installation

1. Clone the repository:

```bash
   git clone https://github.com/zmkest/bus_company_api.git
```

2. Copy `.env.template` and rename it to `.env`.
3. Install dependencies:

```bash
   pnpm install
```

## Configuration

### Environment Variables

| Variable                 | Description                        |
| ------------------------ | ---------------------------------- |
| `PORT`                   | Port where the server runs         |
| `DATABASE_URL`           | PostgreSQL connection string       |
| `JWT_SECRET`             | Jwt secret string                  |
| `JWT_REFRESH_SECRET`     | Jwt refresh secret string          |
| `JWT_PWD_SETUP_SECRET`   | Jwt password setup secret string   |
| `JWT_PWD_SETUP_PURPOSE`  | Jwt password setup prupose string  |
| `JWT_PWD_SETUP_ISSUER`   | Jwt password setup issuer string   |
| `JWT_PWD_SETUP_AUDIENCE` | Jwt password setup audience string |
| `JWT_PWD_RESET_SECRET`   | Jwt password reset secret string   |
| `JWT_PWD_RESET_PURPOSE`  | Jwt password reset prupose string  |
| `JWT_PWD_RESET_ISSUER`   | Jwt password reset issuer string   |
| `JWT_PWD_RESET_AUDIENCE` | Jwt password reset audience string |
| `FRONTEND_URL`           | Frontend url string                |

### Supabase

1. Create a new project.
2. Save the project's database password.
3. Copy the `DATABASE_URL` connection string and paste it into your `.env` file.

### Prisma

```bash
pnpm prisma generate
pnpm prisma migrate dev
```

## Running the App

```bash
# development
pnpm start

# watch mode
pnpm start:dev

# production
pnpm start:prod
```

## Testing

```bash
pnpm test
pnpm test:e2e
```

## Documentación

- [Problemas resueltos](docs/tickets.md) — Practical cases and solutions

## License

MIT
