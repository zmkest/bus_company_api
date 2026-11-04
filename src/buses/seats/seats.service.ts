import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';

@Injectable()
export class SeatsService {
  private readonly seats: PrismaService['seat'];
  constructor(private readonly prisma: PrismaService) {
    this.seats = this.prisma.seat;
  }

  async addSeat(busId: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureBusExists(tx, busId);

        const { _max } = await tx.seat.aggregate({
          where: { busId },
          _max: { number: true },
        });

        if (_max.number && _max.number >= 80) {
          throw new ConflictException(
            `El bus con id #${busId} ya tiene el máximo de asientos asignados`,
          );
        }

        const nextNumber = (_max.number ?? 0) + 1;

        await tx.seat.create({
          data: {
            busId,
            number: nextNumber,
          },
        });
        return { busId, created: 1 };
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          `No se pudo agregar el asiento al bus #${busId}, intenta de nuevo`,
        );
      }
      throw error;
    }
  }

  async createMany(busId: number, totalSeats: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureBusExists(tx, busId);

        const existingSeats = await tx.seat.count({ where: { busId } });
        if (existingSeats > 0)
          throw new ConflictException(`El bus con id #${busId} ya tiene asientos asignados`);

        const { count } = await tx.seat.createMany({
          data: Array.from({ length: totalSeats }, (_, i) => ({
            busId,
            number: i + 1,
          })),
        });
        return { busId, created: count };
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(`El bus #${busId} ya tiene asientos registrados`);
      }
      throw error;
    }
  }

  async trimSeats(busId: number, keep: number) {
    await this.ensureBusExists(this.prisma, busId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.seat.deleteMany({
          where: { busId, number: { gt: keep } },
        });
        return { busId, deleted: count };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException(
          `No se puede reducir el bus #${busId} a ${keep} asientos: algunos ya tienen tickets`,
        );
      }
      throw error;
    }
  }

  private async ensureBusExists(tx: Prisma.TransactionClient, busId: number) {
    const bus = await tx.bus.findUnique({
      where: { id: busId },
      select: { id: true },
    });
    if (!bus) throw new NotFoundException(`Bus con id #${busId} no existe`);
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
