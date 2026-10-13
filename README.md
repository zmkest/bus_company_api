# Bus Company Backend

A backend API for managing bus trips, ticket sales, and seat allocation.

## Features
- Authentication and Authorization
- Trip management
- Ticket sales
- Seat allocation

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
| Variable | Description |
|---|---|
| `PORT` | Port where the server runs |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Jwt secret string |
| `JWT_REFRESH_SECRET` | Jwt refresh secret string |
| `JWT_PWD_SETUP_SECRET` | Jwt password setup secret string |
| `JWT_PWD_SETUP_PURPOSE` | Jwt password setup prupose string |
| `JWT_PWD_SETUP_ISSUER` | Jwt password setup issuer string |
| `JWT_PWD_SETUP_AUDIENCE` | Jwt password setup audience string |
| `JWT_PWD_RESET_SECRET` | Jwt password reset secret string |
| `JWT_PWD_RESET_PURPOSE` | Jwt password reset prupose string |
| `JWT_PWD_RESET_ISSUER` | Jwt password reset issuer string |
| `JWT_PWD_RESET_AUDIENCE` | Jwt password reset audience string |
| `FRONTEND_URL` | Frontend url string |

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
```

## License
MIT