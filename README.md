# Bus Company Backend

A backend API for managing bus trips, ticket sales, and seat allocation.

## Features
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
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Port where the server runs |

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