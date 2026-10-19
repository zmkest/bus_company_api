import { Test, TestingModule } from '@nestjs/testing';
import { BusesService } from './buses.service.js';
import { BusStatus, MaintenanceType } from '../generated/prisma/enums.js';
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
      create: vi.fn(),
    },
    maintenance: {
      findFirst: vi.fn(),
      create: vi.fn(),
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
      .compile();

    prismaMock.$transaction.mockImplementation((cb) => cb(prismaMock));
    service = module.get<BusesService>(BusesService);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Metodo updateStatusAndHistory', () => {
    const userId = 5;

    it('El findunique devuelve NotFoundException', async () => {
      prismaMock.bus.findUnique.mockResolvedValue(null);

      await expect(service.updateStatusAndHistory(busData.id, { status: BusStatus.AVAILABLE }, userId ))
        .rejects.toThrow(NotFoundException);

      expect(prismaMock.bus.findUnique).toHaveBeenCalledWith({
        where: { id: busData.id }
      });
      expect(prismaMock.maintenance.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.bus.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.busStatusHistory.create).not.toHaveBeenCalled();
      expect(prismaMock.maintenance.create).not.toHaveBeenCalled();
    });

    it('Prueba exitosa', async () => {
      const busUpdate = { 
        status: BusStatus.MAINTENANCE,
        type: MaintenanceType.PREVENTIVE,
        startedAt: new Date()
      };
      const busResolved = { ...busData, status: busUpdate.status };

      prismaMock.bus.findUnique.mockResolvedValue(busData);
      prismaMock.maintenance.findFirst.mockResolvedValue(null);

      prismaMock.bus.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.busStatusHistory.create.mockResolvedValue({});
      prismaMock.bus.findUniqueOrThrow.mockResolvedValue(busResolved)

      await expect(service.updateStatusAndHistory(busData.id, busUpdate, userId))
        .resolves.toEqual(busResolved);

      expect(prismaMock.bus.updateMany).toHaveBeenCalledWith({
        where: { id: busData.id, status: busData.status },
        data: { status: busUpdate.status }
      });

      expect(prismaMock.busStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          busId: busData.id,
          fromStatus: busData.status,
          toStatus: busUpdate.status,
          changedById: userId,
        })
      });

      expect(prismaMock.maintenance.create).toHaveBeenCalledWith({
        data: { busId: busData.id, type: busUpdate.type, startedAt: busUpdate.startedAt}
      });

    });

    it('Perder la carrera si entran dos peticiones', async () => {
      const busUpdateUser1 = { 
        status: BusStatus.MAINTENANCE, 
        reason: 'revision', 
        type: MaintenanceType.PREVENTIVE, 
        startedAt: new Date() 
      };

      prismaMock.bus.findUnique.mockResolvedValue(busData);
      prismaMock.bus.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.updateStatusAndHistory(busData.id, busUpdateUser1, userId))
        .rejects.toThrow(ConflictException);

      expect(prismaMock.bus.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: busData.id, status: busData.status }
        })
      );
      
      expect(prismaMock.busStatusHistory.create).not.toHaveBeenCalled();
      expect(prismaMock.maintenance.create).not.toHaveBeenCalled();
    });

    it ('ON_ROUTE → MAINTENANCE return 409', async() => {
      const { id: busId, ...data} = busData;
      const fromStatus = BusStatus.ON_ROUTE;
      const toStatus = BusStatus.MAINTENANCE;

      prismaMock.bus.findUnique.mockResolvedValue({ ...data, status: fromStatus });
      
      await expect(service.updateStatusAndHistory(busId, { status: toStatus }, userId))
        .rejects.toThrow(ConflictException);
      
      expect(prismaMock.bus.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.busStatusHistory.create).not.toHaveBeenCalled();      
    expect(prismaMock.maintenance.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.maintenance.create).not.toHaveBeenCalled();
    });
  });

});
