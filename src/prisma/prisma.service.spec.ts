import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service.js';
import { ConfigService } from '@nestjs/config';

describe('PrismaService', () => {
  let service: PrismaService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: PrismaService, useValue: {}}, 
        ConfigService
      ],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
