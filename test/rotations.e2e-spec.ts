import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DateTime } from 'luxon';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers/app.js';
import { resetDatabase } from './helpers/db.js';
import { createBus, createUser } from './helpers/factories.js';
import { authHeader } from './helpers/auth.js';
import { UserRole, Weekday } from '../src/generated/prisma/enums.js';

const ZONE = 'America/Guayaquil';
const DURATION = 540;
const { MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY } = Weekday;

describe('Rotations', { timeout: 60_000 }, () => {
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

  const monday = DateTime.now().setZone(ZONE).startOf('week').plus({ weeks: 1 });
  const range = { from: monday.toISODate()!, to: monday.plus({ days: 6 }).toISODate()! };
  const localAt = (dayOffset: number, hhmm: string) => {
    const [hour, minute] = hhmm.split(':').map(Number);
    return monday.plus({ days: dayOffset }).set({ hour, minute, second: 0, millisecond: 0 });
  };

  const terminal = async (name: string) => {
    const city = await prisma.city.create({ data: { name } });
    return prisma.terminal.create({ data: { name: `Terminal ${name}`, cityId: city.id } });
  };

  /** Ejemplo Cuenca–Quito: F1/F2 06:00 L-V, F3 08:00 sábado, F4 14:00 domingo */
  const seed = async () => {
    const [cuenca, quito] = [await terminal('Cuenca'), await terminal('Quito')];
    const route = (originId: number, destinationId: number) =>
      prisma.route.create({
        data: { originId, destinationId, distanceKm: 450, durationMinutes: DURATION },
      });
    const cuencaQuito = await route(cuenca.id, quito.id);
    const quitoCuenca = await route(quito.id, cuenca.id);

    const frequency = (routeId: number, hhmm: string, weekdays: Weekday[]) =>
      prisma.frequency.create({
        data: {
          routeId,
          departureTime: new Date(`1970-01-01T${hhmm}:00Z`),
          weekdays,
          basePrice: 15,
        },
      });
    const workdays = [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY];
    const F1 = await frequency(cuencaQuito.id, '06:00', workdays);
    const F2 = await frequency(quitoCuenca.id, '06:00', workdays);
    const F3 = await frequency(quitoCuenca.id, '08:00', [SATURDAY]);
    const F4 = await frequency(cuencaQuito.id, '14:00', [SUNDAY]);

    const bus12 = await createBus(prisma);
    const bus15 = await createBus(prisma);

    const legsA = [
      { frequencyId: F1.id, weekday: MONDAY },
      { frequencyId: F2.id, weekday: TUESDAY },
      { frequencyId: F1.id, weekday: WEDNESDAY },
      { frequencyId: F2.id, weekday: THURSDAY },
      { frequencyId: F1.id, weekday: FRIDAY },
      { frequencyId: F3.id, weekday: SATURDAY },
    ];
    const legsB = [
      { frequencyId: F2.id, weekday: MONDAY },
      { frequencyId: F1.id, weekday: TUESDAY },
      { frequencyId: F2.id, weekday: WEDNESDAY },
      { frequencyId: F1.id, weekday: THURSDAY },
      { frequencyId: F2.id, weekday: FRIDAY },
      { frequencyId: F4.id, weekday: SUNDAY },
    ];

    return { cuencaQuito, quitoCuenca, F1, F2, F3, F4, bus12, bus15, legsA, legsB };
  };

  const api = async (role: UserRole = UserRole.OPERATOR) => {
    const headers = await authHeader(jwt, await createUser(prisma, { role }));
    const server = app.getHttpServer();
    return {
      post: (url: string, body: object) => request(server).post(url).set(headers).send(body),
      patch: (url: string, body: object) => request(server).patch(url).set(headers).send(body),
      get: (url: string) => request(server).get(url).set(headers),
    };
  };

  const manualTrip = (route: { id: number }, departure: DateTime, busId: number) => {
    const scheduledArrival = departure.plus({ minutes: DURATION }).toJSDate();
    return prisma.trip.create({
      data: {
        routeId: route.id,
        busId,
        scheduledDeparture: departure.toJSDate(),
        scheduledArrival,
        estimatedArrival: scheduledArrival,
        durationMinutes: DURATION,
        price: 10,
      },
    });
  };

  const tripOf = (frequencyId: number, departure: DateTime) =>
    prisma.trip.findUniqueOrThrow({
      where: {
        frequencyId_scheduledDeparture: { frequencyId, scheduledDeparture: departure.toJSDate() },
      },
    });

  const createRotations = async (s: Awaited<ReturnType<typeof seed>>) => {
    const client = await api();
    const a = await client.post('/api/rotations', {
      name: 'Rotación A',
      busId: s.bus12.id,
      legs: s.legsA,
    });
    const b = await client.post('/api/rotations', {
      name: 'Rotación B',
      busId: s.bus15.id,
      legs: s.legsB,
    });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    return { a: a.body as { id: number }, b: b.body as { id: number }, client };
  };

  describe('POST /api/rotations', () => {
    it('rejects a frequency-day already covered by another rotation', async () => {
      const s = await seed();
      const { client } = await createRotations(s);

      const res = await client.post('/api/rotations', { name: 'Copia', legs: s.legsA });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('Rotación A');
    });

    it('rejects a bus that already belongs to another active rotation', async () => {
      const s = await seed();
      const client = await api();
      await client.post('/api/rotations', { name: 'Rotación A', busId: s.bus12.id, legs: s.legsA });

      const res = await client.post('/api/rotations', {
        name: 'Rotación B',
        busId: s.bus12.id,
        legs: s.legsB,
      });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('Rotación A');
    });

    it('the partial unique index blocks two active rotations with the same bus', async () => {
      const s = await seed();
      await prisma.rotation.create({ data: { name: 'X', busId: s.bus12.id } });
      await prisma.rotation.create({
        data: { name: 'Inactiva', busId: s.bus12.id, isActive: false },
      });

      const error: unknown = await prisma.rotation
        .create({ data: { name: 'Y', busId: s.bus12.id } })
        .catch((e: unknown) => e);

      expect(JSON.stringify(error) + String(error)).toContain('rotation_active_bus_unique');
    });

    it('rejects a cycle that does not close with a message naming the legs', async () => {
      const s = await seed();
      const client = await api();

      const res = await client.post('/api/rotations', {
        name: 'Incompleta',
        legs: s.legsA.filter((l) => l.weekday !== SATURDAY),
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Viernes');
      expect(res.body.message).toContain('Terminal Quito');
    });

    it('forbids SELLER role', async () => {
      const client = await api(UserRole.SELLER);

      expect((await client.get('/api/rotations')).status).toBe(403);
    });
  });

  describe('POST /api/trips/generate with rotations', () => {
    it('assigns every trip of the example week and is idempotent', async () => {
      const s = await seed();
      const { a, b, client } = await createRotations(s);

      const first = await client.post('/api/trips/generate', range);

      expect(first.status).toBe(201);
      expect(first.body).toEqual({ created: 12, skipped: 0, assigned: 12, unassigned: [] });

      const trips = await prisma.trip.findMany();
      const byRotation = (id: number) => trips.filter((t) => t.rotationId === id);
      expect(byRotation(a.id)).toHaveLength(6);
      expect(byRotation(b.id)).toHaveLength(6);
      expect(byRotation(a.id).every((t) => t.busId === s.bus12.id)).toBe(true);
      expect(byRotation(b.id).every((t) => t.busId === s.bus15.id)).toBe(true);

      const second = await client.post('/api/trips/generate', range);
      expect(second.body).toEqual({ created: 0, skipped: 12, assigned: 0, unassigned: [] });
    });

    it('a manual trip overlapping Monday F1 leaves only that candidate unassigned', async () => {
      const s = await seed();
      const { a, client } = await createRotations(s);
      // Cuenca -> Quito el lunes 07:00: el bus 12 termina en Quito
      const manual = await manualTrip(s.cuencaQuito, localAt(0, '07:00'), s.bus12.id);

      const res = await client.post('/api/trips/generate', range);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ created: 12, skipped: 0, assigned: 11 });
      expect(res.body.unassigned).toEqual([
        {
          frequencyId: s.F1.id,
          scheduledDeparture: localAt(0, '06:00').toUTC().toISO(),
          code: 'OVERLAP',
          message: expect.stringContaining(`#${manual.id}`),
          conflictTripId: manual.id,
        },
      ]);

      const mondayF1 = await tripOf(s.F1.id, localAt(0, '06:00'));
      expect(mondayF1).toMatchObject({ busId: null, rotationId: a.id });

      // El viaje manual dejó al bus en Quito, así que el martes F2 (Quito -> Cuenca) cuadra
      const tuesdayF2 = await tripOf(s.F2.id, localAt(1, '06:00'));
      expect(tuesdayF2).toMatchObject({ busId: s.bus12.id, rotationId: a.id });
    });

    it('a manual trip on the previous Sunday that ends in Quito breaks Monday F1', async () => {
      const s = await seed();
      const { client } = await createRotations(s);
      const manual = await manualTrip(s.cuencaQuito, localAt(-1, '08:00'), s.bus12.id);

      const res = await client.post('/api/trips/generate', range);

      expect(res.body.unassigned).toEqual([
        expect.objectContaining({
          frequencyId: s.F1.id,
          code: 'LOCATION_MISMATCH',
          conflictTripId: manual.id,
        }),
      ]);
      expect((await tripOf(s.F2.id, localAt(1, '06:00'))).busId).toBe(s.bus12.id);
    });

    it('an inactive rotation behaves as if there were no leg', async () => {
      const s = await seed();
      const { a, client } = await createRotations(s);
      await client.patch(`/api/rotations/${a.id}/active`, { isActive: false });

      const res = await client.post('/api/trips/generate', range);

      expect(res.body).toEqual({ created: 12, skipped: 0, assigned: 6, unassigned: [] });
      expect(await prisma.trip.count({ where: { rotationId: a.id } })).toBe(0);
    });

    it('a rotation without bus links its trips and reports them', async () => {
      const s = await seed();
      const client = await api();
      const a = await client.post('/api/rotations', { name: 'Sin bus', legs: s.legsA });

      const res = await client.post('/api/trips/generate', range);

      expect(res.body.assigned).toBe(0);
      expect(res.body.unassigned).toHaveLength(6);
      expect(res.body.unassigned[0].code).toBe('ROTATION_NO_BUS');
      expect(await prisma.trip.count({ where: { rotationId: a.body.id } })).toBe(6);
    });
  });

  describe('PATCH /api/rotations/:id', () => {
    it('detaches future trips that no longer match the legs, keeping their bus', async () => {
      const s = await seed();
      const { a, client } = await createRotations(s);
      await client.post('/api/trips/generate', range);

      const res = await client.patch(`/api/rotations/${a.id}`, {
        legs: [
          { frequencyId: s.F1.id, weekday: MONDAY },
          { frequencyId: s.F2.id, weekday: TUESDAY },
        ],
      });

      expect(res.status).toBe(200);
      expect(res.body.detachedTrips).toBe(4);
      expect(res.body.legs).toHaveLength(2);

      const saturday = await tripOf(s.F3.id, localAt(5, '08:00'));
      expect(saturday).toMatchObject({ rotationId: null, busId: s.bus12.id });
    });
  });

  describe('PATCH /api/rotations/:id/bus', () => {
    it('adopts unassigned trips generated before the rotation and reports failures', async () => {
      const s = await seed();
      const client = await api();
      await client.post('/api/trips/generate', range);

      const other = await createBus(prisma);
      const wednesday = await tripOf(s.F1.id, localAt(2, '06:00'));
      await prisma.trip.update({ where: { id: wednesday.id }, data: { busId: other.id } });

      const created = await client.post('/api/rotations', { name: 'Rotación A', legs: s.legsA });
      const id = (created.body as { id: number }).id;

      const res = await client.patch(`/api/rotations/${id}/bus`, {
        busId: s.bus12.id,
        applyFrom: range.from,
      });

      expect(res.status).toBe(200);
      expect(res.body.rotation.bus.id).toBe(s.bus12.id);
      // El miércoles lo tiene otro bus, así que el jueves (sale de Quito) no cuadra: el bus 12 sigue en Cuenca
      expect(res.body.reassigned).toBe(4);
      expect(res.body.unassigned).toEqual([
        expect.objectContaining({
          frequencyId: s.F2.id,
          code: 'LOCATION_MISMATCH',
          scheduledDeparture: localAt(3, '06:00').toUTC().toISO(),
        }),
      ]);

      expect(await tripOf(s.F1.id, localAt(2, '06:00'))).toMatchObject({
        busId: other.id,
        rotationId: null,
      });
      expect(await tripOf(s.F2.id, localAt(3, '06:00'))).toMatchObject({
        busId: null,
        rotationId: id,
      });
      expect(await tripOf(s.F1.id, localAt(0, '06:00'))).toMatchObject({
        busId: s.bus12.id,
        rotationId: id,
      });
      // Los viajes de los legs de B no se tocan
      expect(await tripOf(s.F2.id, localAt(0, '06:00'))).toMatchObject({
        busId: null,
        rotationId: null,
      });
    });

    it('moves the rotation trips to the new bus', async () => {
      const s = await seed();
      const { a, client } = await createRotations(s);
      await client.post('/api/trips/generate', range);
      const bus20 = await createBus(prisma);

      const res = await client.patch(`/api/rotations/${a.id}/bus`, {
        busId: bus20.id,
        applyFrom: range.from,
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ reassigned: 6, unassigned: [] });
      expect(await prisma.trip.count({ where: { rotationId: a.id, busId: bus20.id } })).toBe(6);
    });

    it('rejects a bus already used by another active rotation', async () => {
      const s = await seed();
      const { a, client } = await createRotations(s);

      const res = await client.patch(`/api/rotations/${a.id}/bus`, { busId: s.bus15.id });

      expect(res.status).toBe(409);
    });
  });
});
