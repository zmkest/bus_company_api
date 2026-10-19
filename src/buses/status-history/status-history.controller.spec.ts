import { Test, TestingModule } from '@nestjs/testing';
import { StatusHistoryController } from './status-history.controller.js';
import { StatusHistoryService } from './status-history.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../../identity/user/user.service.js';

describe('StatusHistoryController', () => {
  let controller: StatusHistoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatusHistoryController],
      providers: [
        StatusHistoryService,
        { provide: PrismaService, useValue: {}},
        { provide: JwtService, useValue: {}},
        { provide: UserService, useValue: {}},
      ],
    }).compile();

    controller = module.get<StatusHistoryController>(StatusHistoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
