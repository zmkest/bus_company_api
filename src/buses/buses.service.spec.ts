import { Test, TestingModule } from '@nestjs/testing';
import { BusesService } from './buses.service.js';
import { AuthGuard } from '../identity/auth/common/guards/auth.guard.js';
import { RoleGuard } from '../common/guards/role.guard.js';
import { BusStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('BusesService', () => {
  let service: BusesService;

  const prismaMock = {
    bus: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    $transaction: vi.fn(),
    busStatusHistory: {
      create: vi.fn()
    }
  };

  const busData = {
    id: 1, plate: 'ASD-123', model: 'Ford',
    year: 2015, odometerKm: 15000, status: BusStatus.AVAILABLE
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusesService,
        { provide: PrismaService, useValue: prismaMock },
      ]
    })
      .overrideGuard(AuthGuard).useValue({ canActive: () => true })
      .overrideGuard(RoleGuard).useValue({ canActive: () => true })
      .compile();

    prismaMock.$transaction.mockImplementation((cb) => cb(prismaMock));
    service = module.get<BusesService>(BusesService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Buses service', () => {
    const userId = 5;

    it('Lanza NotFoundException si el bus no existe', async () => {
      prismaMock.bus.findUnique.mockResolvedValue(null);

      await expect(service.findOne(busData.id)).rejects.toThrow(NotFoundException);

      expect(prismaMock.bus.findUnique).toHaveBeenCalledWith({ where: { id: busData.id } });
    });

    it('actualiza el estado del bus y registra en el historial de estados', async () => {
      const busUpdate = { status: BusStatus.ON_ROUTE };
      const busResolved = { ...busData, status: busUpdate.status };

      prismaMock.bus.findUnique.mockResolvedValue(busData);
      prismaMock.bus.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.busStatusHistory.create.mockResolvedValue({});
      prismaMock.bus.findUniqueOrThrow.mockResolvedValue(busResolved)

      await expect(service.updateStatusAndHistory(busData.id, busUpdate, userId))
        .resolves.toEqual(busResolved);

      expect(prismaMock.bus.updateMany).toHaveBeenCalledWith({
        where: { id: busData.id, status: busData.status },
        data: busUpdate
      });

      expect(prismaMock.busStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          busId: busData.id,
          fromStatus: busData.status,
          toStatus: busUpdate.status,
          changedById: userId,
        })
      });

    });

    it.each([
      [BusStatus.ON_ROUTE, BusStatus.MAINTENANCE],
      [BusStatus.MAINTENANCE, BusStatus.ON_ROUTE],
      [BusStatus.AVAILABLE, BusStatus.AVAILABLE],
    ])('rechaza la transacción de %s -> %s', async (from, to) => {
      prismaMock.bus.findUnique.mockResolvedValue({ ...busData, status: from });

      await expect(service.updateStatusAndHistory(busData.id, { status: to }, userId))
        .rejects.toThrow(ConflictException);

      expect(prismaMock.bus.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.busStatusHistory.create).not.toHaveBeenCalled();
    });

    it('Lanza ConflicException si otro usuario cambió el estado antes', async () => {
      const busUpdateUser1 = { status: BusStatus.ON_ROUTE };

      prismaMock.bus.findUnique.mockResolvedValue(busData);
      prismaMock.bus.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.updateStatusAndHistory(busData.id, busUpdateUser1, userId))
        .rejects.toThrow(ConflictException);

      expect(prismaMock.busStatusHistory.create).not.toHaveBeenCalled();
    });
  });
});
