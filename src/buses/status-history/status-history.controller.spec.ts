import { Test, TestingModule } from '@nestjs/testing';
import { StatusHistoryController } from './status-history.controller.js';
import { StatusHistoryService } from './status-history.service.js';

describe('StatusHistoryController', () => {
  let controller: StatusHistoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatusHistoryController],
      providers: [StatusHistoryService],
    }).compile();

    controller = module.get<StatusHistoryController>(StatusHistoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
