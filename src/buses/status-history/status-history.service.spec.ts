import { Test, TestingModule } from '@nestjs/testing';
import { StatusHistoryService } from './status-history.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('StatusHistoryService', () => {
  let service: StatusHistoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatusHistoryService,
        { provide: PrismaService, useValue: {}},
        
      ],
    }).compile();

    service = module.get<StatusHistoryService>(StatusHistoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
