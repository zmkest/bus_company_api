import { Test } from '@nestjs/testing';
import { BusesController } from './buses.controller.js';
import { BusesService } from './buses.service.js';
import { BusStatus } from '../generated/prisma/enums.js';
import { AuthGuard } from '../identity/auth/common/guards/auth.guard.js';
import { RoleGuard } from '../common/guards/role.guard.js';
import { Mocked } from 'vitest';

describe('BusesController', () => {
  let controller: BusesController;
  let service: Mocked<BusesService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [BusesController],
      providers: [{ provide: BusesService, useValue: { 
        create: vi.fn(),
        findAll: vi.fn(),
        findOne: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
        count: vi.fn(),
        countStatus: vi.fn(),
      } }],
    })
      .overrideGuard(AuthGuard).useValue({ canActive: () => true })
      .overrideGuard(RoleGuard).useValue({ canActive: () => true })
      .compile();

    controller = module.get(BusesController);
    service = module.get(BusesService);
  });

  const dtoCreate = {
    model: 'ford-test',
    plate: 'axs-256',
    status: BusStatus.AVAILABLE,
    year: 2015,
    odometerKm: 8
  };

  const busData = {
    model: 'ford-test',
    plate: 'axs-256',
    status: BusStatus.AVAILABLE,
    year: 2015,
    odometerKm: 8,
    id: 5,
    createdAt: new Date('12-10-2026'),
    updatedAt: new Date('12-10-2026'),
  };

  it('create delega en el servicio', async () => {


    service.create.mockResolvedValue(
      {
        id: 5,
        createdAt: new Date('12-10-2000'),
        updatedAt: new Date('12-10-2000'),
        ...dtoCreate
      });

    await expect(controller.create(dtoCreate)).resolves.toEqual({
      id: 5,
      createdAt: new Date('12-10-2000'),
      updatedAt: new Date('12-10-2000'),
      ...dtoCreate
    });

    expect(service.create).toHaveBeenLastCalledWith(dtoCreate);
  });

  it('findAll delega en el servicio', async () => {
    const query = {
      page: 1,
      limit: 5,
      search: ''
    }

    service.findAll.mockResolvedValue({
      items: [busData],
      meta: {
        limit: query.limit,
        page: query.page,
        total: 1,
        hasNext: false,
        hasPrev: false,
        totalPages: 1
      }
    });

    await expect(controller.findAll({sortBy: 'createdAt', order: 'asc', ...query})).resolves.toEqual({
      items: [busData],
      meta: {
        limit: query.limit,
        page: query.page,
        total: 1,
        hasNext: false,
        hasPrev: false,
        totalPages: 1
      }
    });

    expect(service.findAll).toHaveBeenLastCalledWith({sortBy: 'createdAt', order: 'asc', ...query});


  });

  it('findOne delega en el servicio', async () => {
    const paramId = 5;

    service.findOne.mockResolvedValue(busData);

    await expect(controller.findOne(paramId)).resolves.toEqual(busData);

    expect(service.findOne).toHaveBeenLastCalledWith(paramId);
  })

  it('update delega en el servicio', async () => {
    const paramId = 5;
    const { model, ...updateBus} = busData;
    service.update.mockResolvedValue({ model: 'baby', ...updateBus});

    await expect(controller.update(paramId, { model: 'baby' })).resolves.toEqual({ model: 'baby', ...updateBus});

    expect(service.update).toHaveBeenLastCalledWith(paramId, { model: 'baby' });
  });

  it('delete delega en el servicio', async () => {
    const paramId = 5;

    service.remove.mockResolvedValue(busData);

    await expect(controller.remove(paramId)).resolves.toEqual(busData);

    expect(service.remove).toHaveBeenLastCalledWith(paramId);
  })

  it('count delega en el servicio', async () => {
    service.count.mockResolvedValue(0);

    await expect(controller.count()).resolves.toEqual(0);

    expect(service.count).toHaveBeenLastCalledWith();
  });

  it('countStatus delega en el servicio', async () => {
    service.countStatus.mockResolvedValue(0);

    await expect(controller.countStatus(BusStatus.AVAILABLE)).resolves.toEqual(0);

    expect(service.countStatus).toHaveBeenLastCalledWith(BusStatus.AVAILABLE);
  });

});
