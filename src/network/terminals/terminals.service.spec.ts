import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TerminalsService } from './terminals.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('TerminalsService', () => {
  let service: TerminalsService;

  const prismaMock = {
    terminal: {
      findUnique: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TerminalsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<TerminalsService>(TerminalsService);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('findOne', () => {
    it('returns the terminal with its city', async () => {
      const terminal = {
        id: 1,
        name: 'Terminal Terrestre',
        cityId: 2,
        address: 'Av. Principal',
        city: { id: 2, name: 'Quito' },
      };
      prismaMock.terminal.findUnique.mockResolvedValue(terminal);

      await expect(service.findOne(1)).resolves.toEqual(terminal);
      expect(prismaMock.terminal.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { city: true },
      });
    });

    it('throws NotFoundException when the terminal does not exist', async () => {
      prismaMock.terminal.findUnique.mockResolvedValue(null);

      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });
});
