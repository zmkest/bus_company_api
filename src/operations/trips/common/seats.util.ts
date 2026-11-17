import { Prisma } from '../../../generated/prisma/client.js';
import { TicketStatus } from '../../../generated/prisma/enums.js';

/** Tickets que ocupan un asiento operativo: pagados, abordados o reservas vigentes */
export const occupyingTicketWhere = (now: Date): Prisma.TicketWhereInput => ({
  seat: { isOperational: true },
  OR: [
    { status: { in: [TicketStatus.PAID, TicketStatus.BOARDED] } },
    {
      status: TicketStatus.RESERVED,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  ],
});

export const seatCountsSelect = (now: Date) =>
  ({
    bus: { select: { _count: { select: { seats: { where: { isOperational: true } } } } } },
    _count: { select: { tickets: { where: occupyingTicketWhere(now) } } },
  }) satisfies Prisma.TripSelect;

interface SeatCounts {
  bus: { _count: { seats: number } } | null;
  _count: { tickets: number };
}

/** null cuando el viaje no tiene bus asignado (no hay mapa de asientos) */
export const seatsLeft = ({ bus, _count }: SeatCounts) =>
  bus ? Math.max(0, bus._count.seats - _count.tickets) : null;
