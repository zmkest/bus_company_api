import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DateTime } from 'luxon';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers/app.js';
import { resetDatabase } from './helpers/db.js';
import { createBus, createUser } from './helpers/factories.js';
import { authHeader } from './helpers/auth.js';
import { BusStatus, TripStatus, UserRole, Weekday } from '../src/generated/prisma/enums.js';
import { isBusOverlapViolation } from '../src/operations/trips/common/prisma-errors.util.js';

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

  describe('PATCH /api/trips/:id/bus', { timeout: 20_000 }, () => {
    const base = DateTime.now()
      .setZone(ZONE)
      .plus({ days: 2 })
      .set({ hour: 8, minute: 0, second: 0, millisecond: 0 });

    const createTrip = (
      route: { id: number; durationMinutes: number },
      departure: DateTime,
      busId: number | null = null,
      status: TripStatus = TripStatus.SCHEDULED,
    ) => {
      const scheduledDeparture = departure.toJSDate();
      const scheduledArrival = departure.plus({ minutes: route.durationMinutes }).toJSDate();
      return prisma.trip.create({
        data: {
          routeId: route.id,
          busId,
          scheduledDeparture,
          scheduledArrival,
          estimatedArrival: scheduledArrival,
          durationMinutes: route.durationMinutes,
          price: 10,
          status,
        },
      });
    };

    const assign = async (tripId: number, busId: number | null) => {
      const user = await createUser(prisma, { role: UserRole.OPERATOR });
      return request(app.getHttpServer())
        .patch(`/api/trips/${tripId}/bus`)
        .set(await authHeader(jwt, user))
        .send({ busId });
    };

    it('assigns a bus to an unassigned trip', async () => {
      const route = await createRoute('Quito', 'Guayaquil');
      const bus = await createBus(prisma);
      const trip = await createTrip(route, base);

      const res = await assign(trip.id, bus.id);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: trip.id, bus: { id: bus.id, plate: bus.plate } });
    });

    it('allows a bus in MAINTENANCE (current state) but not OUT_OF_SERVICE', async () => {
      const route = await createRoute('Quito', 'Guayaquil');
      const inMaintenance = await createBus(prisma, { status: BusStatus.MAINTENANCE });
      const outOfService = await createBus(prisma, { status: BusStatus.OUT_OF_SERVICE });
      const trip = await createTrip(route, base);

      expect((await assign(trip.id, outOfService.id)).status).toBe(409);
      expect((await assign(trip.id, inMaintenance.id)).status).toBe(200);
    });

    it('rejects an overlapping trip considering the turnaround margin', async () => {
      const there = await createRoute('Quito', 'Guayaquil');
      const back = await createRoute('Guayaquil', 'Quito');
      const bus = await createBus(prisma);
      const first = await createTrip(there, base, bus.id);
      const tooSoon = await createTrip(back, base.plus({ minutes: there.durationMinutes + 10 }));

      const res = await assign(tooSoon.id, bus.id);

      expect(res.status).toBe(409);
      expect(res.body.message).toContain(`#${first.id}`);
    });

    it('accepts a chained return trip after the margin', async () => {
      const there = await createRoute('Quito', 'Guayaquil');
      const back = await createRoute('Guayaquil', 'Quito');
      const bus = await createBus(prisma);
      await createTrip(there, base, bus.id);
      const ret = await createTrip(back, base.plus({ minutes: there.durationMinutes + 30 }));

      expect((await assign(ret.id, bus.id)).status).toBe(200);
    });

    it('rejects when the previous trip ends in another terminal', async () => {
      const there = await createRoute('Quito', 'Guayaquil');
      const elsewhere = await createRoute('Cuenca', 'Loja');
      const bus = await createBus(prisma);
      await createTrip(there, base, bus.id);
      const trip = await createTrip(elsewhere, base.plus({ hours: 8 }));

      const res = await assign(trip.id, bus.id);

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('Guayaquil');
      expect(res.body.message).toContain('Cuenca');
    });

    it('removes the bus with null', async () => {
      const route = await createRoute('Quito', 'Guayaquil');
      const bus = await createBus(prisma);
      const trip = await createTrip(route, base, bus.id);

      const res = await assign(trip.id, null);

      expect(res.status).toBe(200);
      expect(res.body.bus).toBeNull();
    });

    it('rejects when the trip is not SCHEDULED', async () => {
      const route = await createRoute('Quito', 'Guayaquil');
      const bus = await createBus(prisma);
      const trip = await createTrip(route, base, null, TripStatus.CANCELLED);

      expect((await assign(trip.id, bus.id)).status).toBe(409);
    });

    it('the database constraint blocks overlapping trips of the same bus', async () => {
      const route = await createRoute('Quito', 'Guayaquil');
      const bus = await createBus(prisma);
      await createTrip(route, base, bus.id);

      const error: unknown = await createTrip(route, base.plus({ hours: 1 }), bus.id).catch(
        (e: unknown) => e,
      );

      expect(isBusOverlapViolation(error)).toBe(true);
    });
  });

  describe('GET /api/trips', { timeout: 20_000 }, () => {
    const seedTrips = async () => {
      const route = await createRoute('Quito', 'Guayaquil');
      const bus = await createBus(prisma);
      const departure = DateTime.now().setZone(ZONE).plus({ days: 3 }).startOf('day');

      await prisma.trip.createMany({
        data: [0, 6, 12].map((hours, i) => {
          const scheduledDeparture = departure.plus({ hours }).toJSDate();
          const scheduledArrival = departure.plus({ hours: hours + 4 }).toJSDate();
          return {
            routeId: route.id,
            busId: i === 0 ? bus.id : null,
            scheduledDeparture,
            scheduledArrival,
            estimatedArrival: scheduledArrival,
            durationMinutes: 240,
            price: 10,
          };
        }),
      });

      return { bus, date: departure.toISODate() };
    };

    const list = async (query: Record<string, string>) => {
      const user = await createUser(prisma, { role: UserRole.OPERATOR });
      return request(app.getHttpServer())
        .get('/api/trips')
        .query(query)
        .set(await authHeader(jwt, user));
    };

    it('returns paginated trips filtered by date', async () => {
      const { date } = await seedTrips();

      const res = await list({ from: date!, to: date!, limit: '2' });

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.meta).toMatchObject({ total: 3, page: 1, limit: 2, hasNext: true });
    });

    it('filters unassigned trips', async () => {
      await seedTrips();

      const res = await list({ unassigned: 'true' });

      expect(res.status).toBe(200);
      expect(res.body.meta.total).toBe(2);
      expect(res.body.items.every((t: { bus: unknown }) => t.bus === null)).toBe(true);
    });

    it('filters by bus plate', async () => {
      const { bus } = await seedTrips();

      const res = await list({ busPlate: bus.plate.toLowerCase() });

      expect(res.status).toBe(200);
      expect(res.body.meta.total).toBe(1);
    });

    it('rejects unassigned=true with busPlate', async () => {
      const res = await list({ unassigned: 'true', busPlate: 'ABC' });

      expect(res.status).toBe(400);
    });
  });
});
