import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DateTime } from 'luxon';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers/app.js';
import { resetDatabase } from './helpers/db.js';
import { createUser } from './helpers/factories.js';
import { authHeader } from './helpers/auth.js';
import { UserRole, Weekday } from '../src/generated/prisma/enums.js';

const ZONE = 'America/Guayaquil';

describe('Trips', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  beforeAll(async () => {
    ({ app, prisma, jwt } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  const createRoute = async (originCity: string, destinationCity: string) => {
    const [origin, destination] = await Promise.all(
      [originCity, destinationCity].map(async (name) => {
        const city =
          (await prisma.city.findFirst({ where: { name } })) ??
          (await prisma.city.create({ data: { name } }));
        return prisma.terminal.upsert({
          where: { name_cityId: { name: `Terminal ${name}`, cityId: city.id } },
          update: {},
          create: { name: `Terminal ${name}`, cityId: city.id, address: 'Av. Principal' },
        });
      }),
    );

    return prisma.route.create({
      data: {
        originId: origin.id,
        destinationId: destination.id,
        distanceKm: 300,
        durationMinutes: 240,
      },
    });
  };

  describe('POST /api/trips/generate', () => {
    it('is idempotent: generating the same range twice creates nothing the second time', async () => {
      const user = await createUser(prisma, { role: UserRole.OPERATOR });
      const route = await createRoute('Quito', 'Guayaquil');
      await prisma.frequency.create({
        data: {
          routeId: route.id,
          departureTime: new Date('1970-01-01T08:00:00Z'),
          weekdays: Object.values(Weekday),
          basePrice: 12.5,
        },
      });

      const from = DateTime.now().setZone(ZONE).plus({ days: 1 });
      const body = { from: from.toISODate(), to: from.plus({ days: 6 }).toISODate() };
      const headers = await authHeader(jwt, user);

      const first = await request(app.getHttpServer())
        .post('/api/trips/generate')
        .set(headers)
        .send(body);
      expect(first.status).toBe(201);
      expect(first.body).toEqual({ created: 7, skipped: 0 });

      const second = await request(app.getHttpServer())
        .post('/api/trips/generate')
        .set(headers)
        .send(body);
      expect(second.status).toBe(201);
      expect(second.body).toEqual({ created: 0, skipped: 7 });

      const trips = await prisma.trip.findMany({ orderBy: { scheduledDeparture: 'asc' } });
      expect(trips).toHaveLength(7);
      expect(trips[0]).toMatchObject({ busId: null, status: 'SCHEDULED', durationMinutes: 240 });
      expect(trips[0].scheduledDeparture.toISOString()).toBe(
        from.set({ hour: 8, minute: 0, second: 0, millisecond: 0 }).toUTC().toISO(),
      );
    });

    it('rejects a range longer than 31 days', async () => {
      const user = await createUser(prisma, { role: UserRole.ADMIN });
      const from = DateTime.now().setZone(ZONE).plus({ days: 1 });

      const res = await request(app.getHttpServer())
        .post('/api/trips/generate')
        .set(await authHeader(jwt, user))
        .send({ from: from.toISODate(), to: from.plus({ days: 31 }).toISODate() });

      expect(res.status).toBe(400);
    });

    it('forbids SELLER role', async () => {
      const user = await createUser(prisma, { role: UserRole.SELLER });

      const res = await request(app.getHttpServer())
        .post('/api/trips/generate')
        .set(await authHeader(jwt, user))
        .send({ from: '2099-01-01', to: '2099-01-02' });

      expect(res.status).toBe(403);
    });
  });
});
