import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { DateTime } from 'luxon';
import { Prisma, PrismaClient } from '../generated/prisma/client.js';
import {
  BusStatus,
  MaintenanceStatus,
  PaymentMethod,
  PaymentStatus,
  TicketStatus,
  TripStatus,
  Weekday,
} from '../generated/prisma/enums.js';
import { WEEKDAY_ORDER } from '../operations/trips/common/trip-schedule.util.js';
import {
  BUS_FINAL_STATUS,
  BusKey,
  DEMO_BUSES,
  DEMO_CREW,
  DEMO_FREQUENCIES,
  DEMO_MAINTENANCES,
  DEMO_PASSWORD,
  DEMO_ROTATIONS,
  DEMO_ROUTES,
  DEMO_TERMINALS,
  DEMO_USERS,
  DemoUserKey,
  PASSENGER_NAMES,
  TerminalKey,
} from './data/demo.data.js';

type Tx = Prisma.TransactionClient;

const PAST_DAYS = 7;
const FUTURE_DAYS = 21;
const TICKET_FUTURE_DAYS = 10;

/** PRNG determinista para que el seed sea reproducible */
function createRng(seed: number) {
  let a = seed;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(list: readonly T[]) => list[Math.floor(next() * list.length)],
    chance: (p: number) => next() < p,
  };
}

/** Cédula ecuatoriana con dígito verificador válido (módulo 10) */
function toCedula(base: string) {
  const digits = base.slice(0, 9).split('').map(Number);
  const sum = digits.reduce((acc, d, i) => {
    const v = i % 2 === 0 ? d * 2 : d;
    return acc + (v > 9 ? v - 9 : v);
  }, 0);
  return `${digits.join('')}${(10 - (sum % 10)) % 10}`;
}

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

const slug = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(' ');

export class DemoSeeder {
  private readonly logger = new Logger(DemoSeeder.name);
  private readonly rng = createRng(20261117);
  private readonly zone: string;
  private readonly now = new Date();

  constructor(
    private readonly prisma: PrismaClient,
    zone: string,
  ) {
    this.zone = zone;
  }

  async run(): Promise<void> {
    const marker = await this.prisma.user.findUnique({ where: { email: DEMO_USERS[0].email } });
    if (marker) {
      this.logger.log('Datos demo ya cargados. Seed omitido.');
      return;
    }

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    await this.prisma.$transaction(
      async (tx) => {
        const users = await this.seedUsers(tx, passwordHash);
        const terminals = await this.seedTerminals(tx);
        const routes = await this.seedRoutes(tx, terminals);
        const frequencies = await this.seedFrequencies(tx, routes);
        const buses = await this.seedBuses(tx, users.admin);
        const rotations = await this.seedRotations(tx, buses, frequencies);
        const crew = await this.seedCrew(tx, users);
        const passengers = await this.seedPassengers(tx, users.passenger);
        const trips = await this.seedTrips(tx, frequencies, rotations, buses);
        await this.seedTripCrew(tx, trips, crew);
        await this.seedTickets(tx, trips, buses, passengers, users.seller);
      },
      { timeout: 300_000, maxWait: 20_000 },
    );

    this.logger.log(`Datos demo cargados. Contraseña de todos los usuarios: ${DEMO_PASSWORD}`);
  }

  private async seedUsers(tx: Tx, passwordHash: string) {
    const ids = {} as Record<DemoUserKey, number>;
    for (const u of DEMO_USERS) {
      const created = await tx.user.create({
        data: { email: u.email, name: u.name, role: u.role, passwordHash },
      });
      ids[u.key] = created.id;
    }
    return ids;
  }

  private async seedTerminals(tx: Tx) {
    const cities = await tx.city.findMany({
      where: { name: { in: [...new Set(DEMO_TERMINALS.map((t) => t.city))] } },
    });
    const cityId = (name: string) => {
      const city = cities.find((c) => c.name === name);
      if (!city) throw new Error(`Ciudad ${name} no encontrada`);
      return city.id;
    };

    const ids = {} as Record<TerminalKey, number>;
    for (const t of DEMO_TERMINALS) {
      const terminal = await tx.terminal.upsert({
        where: { name_cityId: { name: t.name, cityId: cityId(t.city) } },
        update: { address: t.address },
        create: { name: t.name, cityId: cityId(t.city), address: t.address },
      });
      ids[t.key] = terminal.id;
    }
    return ids;
  }

  private async seedRoutes(tx: Tx, terminals: Record<TerminalKey, number>) {
    const routes = new Map<string, { id: number; durationMinutes: number }>();
    for (const r of DEMO_ROUTES) {
      for (const [from, to] of [
        [r.a, r.b],
        [r.b, r.a],
      ] as const) {
        const route = await tx.route.upsert({
          where: {
            originId_destinationId: { originId: terminals[from], destinationId: terminals[to] },
          },
          update: {},
          create: {
            originId: terminals[from],
            destinationId: terminals[to],
            distanceKm: r.km,
            durationMinutes: r.minutes,
          },
        });
        routes.set(`${from}>${to}`, { id: route.id, durationMinutes: route.durationMinutes });
      }
    }
    return routes;
  }

  private async seedFrequencies(
    tx: Tx,
    routes: Map<string, { id: number; durationMinutes: number }>,
  ) {
    const frequencies = new Map<string, FrequencyInfo>();
    for (const f of DEMO_FREQUENCIES) {
      const route = routes.get(`${f.from}>${f.to}`)!;
      const created = await tx.frequency.create({
        data: {
          routeId: route.id,
          departureTime: new Date(`1970-01-01T${f.time}:00Z`),
          weekdays: f.weekdays,
          basePrice: f.price,
          isActive: f.isActive ?? true,
        },
      });
      frequencies.set(f.key, {
        id: created.id,
        routeId: route.id,
        durationMinutes: route.durationMinutes,
        time: f.time,
        weekdays: f.weekdays,
        price: f.price,
        isActive: f.isActive ?? true,
      });
    }
    return frequencies;
  }

  private async seedBuses(tx: Tx, adminId: number) {
    const buses = await tx.bus.createManyAndReturn({
      data: DEMO_BUSES.map((b) => ({
        plate: b.plate,
        model: b.model,
        year: b.year,
        odometerKm: b.odometerKm,
      })),
      select: { id: true, plate: true },
    });
    const info = new Map<BusKey, BusInfo>();
    for (const b of DEMO_BUSES) {
      const id = buses.find((x) => x.plate === b.plate)!.id;
      info.set(b.key, { id, seatIds: [] });
    }

    await tx.seat.createMany({
      data: DEMO_BUSES.flatMap((b) =>
        Array.from({ length: b.seats }, (_, i) => ({
          busId: info.get(b.key)!.id,
          number: i + 1,
          isOperational: !(b.broken as readonly number[]).includes(i + 1),
        })),
      ),
    });
    const seats = await tx.seat.findMany({
      where: { busId: { in: [...info.values()].map((b) => b.id) }, isOperational: true },
      orderBy: { number: 'asc' },
      select: { id: true, busId: true },
    });
    for (const bus of info.values()) {
      bus.seatIds = seats.filter((s) => s.busId === bus.id).map((s) => s.id);
    }

    await this.seedMaintenances(tx, info, adminId);
    return info;
  }

  private async seedMaintenances(tx: Tx, buses: Map<BusKey, BusInfo>, adminId: number) {
    const daysAgo = (days: number, hour = 8) =>
      DateTime.now().setZone(this.zone).minus({ days }).set({ hour, minute: 0 }).toJSDate();

    for (const m of DEMO_MAINTENANCES) {
      const busId = buses.get(m.bus)!.id;
      const startedAt = daysAgo(m.daysAgo);
      const finishedAt = m.cancelled
        ? daysAgo(m.daysAgo, 15)
        : m.durationDays
          ? daysAgo(m.daysAgo - m.durationDays, 17)
          : null;
      const status = m.cancelled
        ? MaintenanceStatus.CANCELLED
        : finishedAt
          ? MaintenanceStatus.COMPLETED
          : MaintenanceStatus.IN_PROGRESS;

      const maintenance = await tx.maintenance.create({
        data: {
          busId,
          type: m.type,
          status,
          description: m.description,
          cost: m.cost ?? null,
          startedAt,
          finishedAt,
          createdAt: startedAt,
        },
      });

      await tx.busStatusHistory.create({
        data: {
          busId,
          fromStatus: BusStatus.AVAILABLE,
          toStatus: BusStatus.MAINTENANCE,
          changedById: adminId,
          reason: m.description,
          maintenanceId: maintenance.id,
          createdAt: startedAt,
        },
      });

      if (finishedAt) {
        await tx.busStatusHistory.create({
          data: {
            busId,
            fromStatus: BusStatus.MAINTENANCE,
            toStatus: BusStatus.AVAILABLE,
            changedById: adminId,
            reason: m.cancelled ? 'Mantenimiento cancelado' : 'Mantenimiento finalizado',
            createdAt: finishedAt,
          },
        });
      }
    }

    for (const [key, status] of Object.entries(BUS_FINAL_STATUS)) {
      const busId = buses.get(key as BusKey)!.id;
      await tx.bus.update({ where: { id: busId }, data: { status } });
      if (status === BusStatus.OUT_OF_SERVICE) {
        await tx.busStatusHistory.create({
          data: {
            busId,
            fromStatus: BusStatus.AVAILABLE,
            toStatus: BusStatus.OUT_OF_SERVICE,
            changedById: adminId,
            reason: 'Unidad con más de 500.000 km, en evaluación para dar de baja',
            createdAt: daysAgo(5),
          },
        });
      }
    }
  }

  private async seedRotations(
    tx: Tx,
    buses: Map<BusKey, BusInfo>,
    frequencies: Map<string, FrequencyInfo>,
  ) {
    const byFrequency = new Map<string, RotationInfo>();
    for (const r of DEMO_ROTATIONS) {
      const legs = r.frequencies.flatMap((key) => {
        const f = frequencies.get(key)!;
        return f.weekdays.map((weekday) => ({ frequencyId: f.id, weekday }));
      });
      const rotation = await tx.rotation.create({
        data: {
          name: r.name,
          busId: r.bus ? buses.get(r.bus)!.id : null,
          legs: { createMany: { data: legs } },
        },
      });
      const info: RotationInfo = {
        id: rotation.id,
        busKey: r.bus,
        driver: r.driver ? toCedula(r.driver) : null,
        assistant: r.assistant ? toCedula(r.assistant) : null,
      };
      r.frequencies.forEach((key) => byFrequency.set(key, info));
    }
    return byFrequency;
  }

  private async seedCrew(tx: Tx, users: Record<DemoUserKey, number>) {
    const today = DateTime.now().setZone(this.zone).startOf('day');
    const created = await tx.crewMember.createManyAndReturn({
      data: DEMO_CREW.map((c) => ({
        document: toCedula(c.document),
        name: c.name,
        position: c.position,
        licenseNumber: c.licenseYearsLeft !== undefined ? toCedula(c.document) : null,
        licenseExpiresAt:
          c.licenseYearsLeft !== undefined
            ? today.plus({ days: Math.round(c.licenseYearsLeft * 365) }).toJSDate()
            : null,
        status: c.status,
        userId: c.user ? users[c.user] : null,
      })),
      select: { id: true, document: true },
    });
    return new Map(created.map((c) => [c.document, c.id]));
  }

  private async seedPassengers(tx: Tx, passengerUserId: number) {
    const firsts = [
      'Juan',
      'María',
      'Luis',
      'Carmen',
      'Pedro',
      'Lucía',
      'Miguel',
      'Sofía',
      'Jorge',
      'Elena',
      'Andrés',
      'Isabel',
      'Fabián',
      'Gloria',
      'Cristina',
      'Byron',
      'Jenny',
      'Wilmer',
      'Mayra',
      'Iván',
    ];
    const lasts = [
      'Pérez',
      'Torres',
      'Morales',
      'Quispe',
      'Cárdenas',
      'Vera',
      'Loor',
      'Paucar',
      'Naranjo',
      'León',
      'Barros',
      'Cobo',
      'Tituaña',
      'Mejía',
      'Rodas',
      'Reyes',
      'Aguirre',
      'Bastidas',
      'Jiménez',
      'Vaca',
    ];

    const names = [...PASSENGER_NAMES];
    while (names.length < 160) {
      const name = `${this.rng.pick(firsts)} ${this.rng.pick(lasts)} ${this.rng.pick(lasts)}`;
      if (!names.includes(name)) names.push(name);
    }

    const documents = new Set<string>();
    const data = names.map((name, i) => {
      let document: string;
      do {
        const province = String(this.rng.int(1, 24)).padStart(2, '0');
        document = toCedula(`${province}${this.rng.int(0, 5)}${this.rng.int(100000, 999999)}`);
      } while (documents.has(document));
      documents.add(document);

      const parts = slug(name);
      const domain = this.rng.pick(['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.es']);
      const hasEmail = i === 0 || this.rng.chance(0.7);
      return {
        document,
        name,
        email:
          i === 0
            ? DEMO_USERS.find((u) => u.key === 'passenger')!.email
            : hasEmail
              ? `${parts[0]}.${parts[1]}${this.rng.int(1, 99)}@${domain}`
              : null,
        phone: this.rng.chance(0.85)
          ? `09${this.rng.pick(['8', '9', '6', '7', '5'])}${this.rng.int(1000000, 9999999)}`
          : null,
        userId: i === 0 ? passengerUserId : null,
        createdAt: DateTime.now()
          .minus({ days: this.rng.int(10, 200) })
          .toJSDate(),
      };
    });

    const created = await tx.passenger.createManyAndReturn({
      data,
      select: { id: true, userId: true },
    });
    return {
      ids: created.map((p) => p.id),
      demoId: created.find((p) => p.userId === passengerUserId)!.id,
    };
  }

  private async seedTrips(
    tx: Tx,
    frequencies: Map<string, FrequencyInfo>,
    rotations: Map<string, RotationInfo>,
    buses: Map<BusKey, BusInfo>,
  ) {
    const today = DateTime.now().setZone(this.zone).startOf('day');
    const data: (Prisma.TripCreateManyInput & { meta: TripMeta })[] = [];

    const push = (
      f: FrequencyInfo | undefined,
      routeId: number,
      durationMinutes: number,
      departure: Date,
      price: number,
      busId: number | null,
      rotation: RotationInfo | undefined,
    ) => {
      const arrival = addMinutes(departure, durationMinutes);
      let status: TripStatus = TripStatus.SCHEDULED;
      let actualDeparture: Date | null = null;
      let actualArrival: Date | null = null;
      let estimatedArrival = arrival;

      if (busId === null && departure < this.now) return;

      if (arrival <= this.now) {
        status = this.rng.chance(0.03) ? TripStatus.CANCELLED : TripStatus.COMPLETED;
        if (status === TripStatus.COMPLETED) {
          actualDeparture = addMinutes(departure, this.rng.int(0, 12));
          actualArrival = addMinutes(arrival, this.rng.int(-10, 35));
        }
      } else if (departure <= this.now) {
        status = TripStatus.IN_PROGRESS;
        actualDeparture = addMinutes(departure, this.rng.int(0, 10));
        estimatedArrival = addMinutes(arrival, this.rng.int(0, 20));
      }

      data.push({
        routeId,
        frequencyId: f?.id ?? null,
        busId,
        rotationId: rotation?.id ?? null,
        scheduledDeparture: departure,
        scheduledArrival: arrival,
        estimatedArrival,
        actualDeparture,
        actualArrival,
        durationMinutes,
        price,
        status,
        createdAt: DateTime.fromJSDate(departure).minus({ days: 20 }).toJSDate(),
        meta: { rotation, busId },
      });
    };

    for (let offset = -PAST_DAYS; offset <= FUTURE_DAYS; offset++) {
      const day = today.plus({ days: offset });
      const weekday = WEEKDAY_ORDER[day.weekday - 1];

      for (const [key, f] of frequencies) {
        if (!f.isActive || !f.weekdays.includes(weekday)) continue;
        const [hour, minute] = f.time.split(':').map(Number);
        const departure = day.set({ hour, minute }).toJSDate();
        const rotation = rotations.get(key);

        let busId: number | null = rotation?.busKey ? buses.get(rotation.busKey)!.id : null;

        // Bus de reserva cubriendo Quito–Cuenca en días alternos durante la próxima semana
        if (!rotation && offset >= 0 && offset <= 7) {
          const b7 = buses.get('B7')!.id;
          if (key === 'UIO-CUE-2100' && offset % 2 === 0) busId = b7;
          if (key === 'CUE-UIO-2030' && offset % 2 === 1) busId = b7;
        }

        push(f, f.routeId, f.durationMinutes, departure, f.price, busId, rotation);
      }
    }

    // Viaje extra sin frecuencia (refuerzo de feriado)
    const extra = frequencies.get('UIO-GYE-0700')!;
    push(
      undefined,
      extra.routeId,
      extra.durationMinutes,
      today.plus({ days: 12 }).set({ hour: 10, minute: 30 }).toJSDate(),
      15,
      buses.get('B7')!.id,
      undefined,
    );

    const created = await tx.trip.createManyAndReturn({
      data: data.map(({ meta: _meta, ...trip }) => trip),
      select: {
        id: true,
        busId: true,
        status: true,
        price: true,
        scheduledDeparture: true,
        rotationId: true,
        routeId: true,
      },
    });

    const tripKey = (t: { routeId: number; scheduledDeparture: Date | string }) =>
      `${t.routeId}:${new Date(t.scheduledDeparture).getTime()}`;
    const meta = new Map(data.map((t) => [tripKey(t), t.meta]));

    this.logger.log(`Viajes demo creados: ${created.length}`);
    return created.map((t) => ({ ...t, rotation: meta.get(tripKey(t))?.rotation }));
  }

  private async seedTripCrew(tx: Tx, trips: SeededTrip[], crew: Map<string, number>) {
    const backupDriver = crew.get(toCedula('1709876543'))!;
    const data = trips.flatMap((t) => {
      if (!t.busId) return [];
      const r = t.rotation;
      const driver = r?.driver ? crew.get(r.driver)! : backupDriver;
      const assistant = r?.assistant ? crew.get(r.assistant) : undefined;
      return [
        { tripId: t.id, crewMemberId: driver },
        ...(assistant ? [{ tripId: t.id, crewMemberId: assistant }] : []),
      ];
    });
    await tx.tripCrew.createMany({ data });
  }

  private async seedTickets(
    tx: Tx,
    trips: SeededTrip[],
    buses: Map<BusKey, BusInfo>,
    passengers: { ids: number[]; demoId: number },
    sellerId: number,
  ) {
    const seatsByBus = new Map([...buses.values()].map((b) => [b.id, b.seatIds]));
    const limit = DateTime.now().plus({ days: TICKET_FUTURE_DAYS }).toJSDate();
    const tickets: (Prisma.TicketCreateManyInput & { method: PaymentMethod | null })[] = [];

    const demoTrips = this.pickDemoTrips(trips);

    for (const trip of trips) {
      if (!trip.busId || trip.scheduledDeparture > limit) continue;
      const seats = seatsByBus.get(trip.busId)!;
      const daysAhead = (trip.scheduledDeparture.getTime() - this.now.getTime()) / 86_400_000;
      const occupancy =
        daysAhead <= 0
          ? this.rng.int(35, 95) / 100
          : Math.max(0.05, this.rng.int(25, 85) / 100 - daysAhead * 0.06);
      const count = Math.round(seats.length * occupancy);

      const shuffledSeats = [...seats].sort(() => this.rng.next() - 0.5).slice(0, count);
      const shuffledPassengers = [...passengers.ids]
        .filter((id) => id !== passengers.demoId)
        .sort(() => this.rng.next() - 0.5);

      const demoStatus = demoTrips.get(trip.id);
      shuffledSeats.forEach((seatId, i) => {
        const passengerId = i === 0 && demoStatus ? passengers.demoId : shuffledPassengers[i];
        const status =
          i === 0 && demoStatus ? demoStatus : this.ticketStatus(trip.status, daysAhead);
        tickets.push(
          this.buildTicket(trip, seatId, passengerId, status, sellerId, i === 0 && !!demoStatus),
        );
      });
    }

    const idByCode = new Map<string, number>();
    for (let i = 0; i < tickets.length; i += 1000) {
      const chunk = tickets.slice(i, i + 1000);
      const created = await tx.ticket.createManyAndReturn({
        data: chunk.map(({ method: _method, ...t }) => t),
        select: { id: true, code: true },
      });
      created.forEach((t) => idByCode.set(t.code, t.id));
    }

    const payments: Prisma.PaymentCreateManyInput[] = [];
    tickets.forEach((t) => {
      if (!t.method) return;
      const status =
        t.status === TicketStatus.CANCELLED ? PaymentStatus.REFUNDED : PaymentStatus.COMPLETED;
      payments.push({
        ticketId: idByCode.get(t.code!)!,
        amount: t.price,
        method: t.method,
        status,
        reference:
          t.method === PaymentMethod.CASH
            ? null
            : `${t.method === PaymentMethod.CARD ? 'AUT' : 'TRF'}-${this.rng.int(100000, 999999)}`,
        createdAt: t.createdAt,
      });
    });
    for (let i = 0; i < payments.length; i += 1000) {
      await tx.payment.createMany({ data: payments.slice(i, i + 1000) });
    }

    this.logger.log(`Tickets demo: ${tickets.length}, pagos: ${payments.length}`);
  }

  /** Viajes donde la pasajera demo tiene un boleto, para que su cuenta muestre historial */
  private pickDemoTrips(trips: SeededTrip[]) {
    const result = new Map<number, TicketStatus>();
    const withBus = trips.filter((t) => t.busId);
    const past = withBus.filter((t) => t.status === TripStatus.COMPLETED);
    const future = withBus.filter(
      (t) =>
        t.status === TripStatus.SCHEDULED &&
        t.scheduledDeparture.getTime() - this.now.getTime() > 86_400_000,
    );
    [past.at(-1), past.at(-15)].forEach((t) => t && result.set(t.id, TicketStatus.BOARDED));
    if (future[3]) result.set(future[3].id, TicketStatus.PAID);
    if (future[20]) result.set(future[20].id, TicketStatus.RESERVED);
    if (future[40]) result.set(future[40].id, TicketStatus.CANCELLED);
    return result;
  }

  private ticketStatus(tripStatus: TripStatus, daysAhead: number): TicketStatus {
    const roll = this.rng.next();
    switch (tripStatus) {
      case TripStatus.CANCELLED:
        return TicketStatus.CANCELLED;
      case TripStatus.COMPLETED:
        return roll < 0.92
          ? TicketStatus.BOARDED
          : roll < 0.97
            ? TicketStatus.CANCELLED
            : TicketStatus.PAID;
      case TripStatus.IN_PROGRESS:
        return roll < 0.96 ? TicketStatus.BOARDED : TicketStatus.PAID;
      default:
        if (daysAhead < 0.1) return roll < 0.9 ? TicketStatus.PAID : TicketStatus.CANCELLED;
        return roll < 0.78
          ? TicketStatus.PAID
          : roll < 0.94
            ? TicketStatus.RESERVED
            : TicketStatus.CANCELLED;
    }
  }

  private buildTicket(
    trip: SeededTrip,
    seatId: number,
    passengerId: number,
    status: TicketStatus,
    sellerId: number,
    online: boolean,
  ) {
    const atCounter = !online && this.rng.chance(0.6);
    const latest = Math.min(this.now.getTime(), trip.scheduledDeparture.getTime() - 30 * 60_000);
    const createdAt = new Date(latest - this.rng.int(1, 9 * 24 * 60) * 60_000);

    let expiresAt: Date | null = null;
    if (status === TicketStatus.RESERVED) {
      // Algunas reservas ya vencieron y no ocupan asiento
      expiresAt = this.rng.chance(0.7)
        ? addMinutes(this.now, this.rng.int(30, 24 * 60))
        : addMinutes(this.now, -this.rng.int(10, 600));
    }

    const method =
      status === TicketStatus.RESERVED
        ? null
        : atCounter
          ? this.rng.chance(0.7)
            ? PaymentMethod.CASH
            : PaymentMethod.CARD
          : this.rng.chance(0.6)
            ? PaymentMethod.CARD
            : PaymentMethod.TRANSFER;

    return {
      code: randomUUID(),
      tripId: trip.id,
      seatId,
      passengerId,
      soldById: atCounter ? sellerId : null,
      price: trip.price,
      status,
      expiresAt,
      createdAt,
      method,
    };
  }
}

interface FrequencyInfo {
  id: number;
  routeId: number;
  durationMinutes: number;
  time: string;
  weekdays: Weekday[];
  price: number;
  isActive: boolean;
}

interface BusInfo {
  id: number;
  seatIds: number[];
}

interface RotationInfo {
  id: number;
  busKey: BusKey | null;
  driver: string | null;
  assistant: string | null;
}

interface TripMeta {
  rotation: RotationInfo | undefined;
  busId: number | null;
}

interface SeededTrip {
  id: number;
  busId: number | null;
  status: TripStatus;
  price: Prisma.Decimal;
  scheduledDeparture: Date;
  rotation: RotationInfo | undefined;
}
