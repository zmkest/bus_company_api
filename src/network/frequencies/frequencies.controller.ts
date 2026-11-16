import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { FrequenciesService } from './frequencies.service.js';
import { CreateFrequencyDto } from './dto/create-frequency.dto.js';
import { AuthGuard } from '../../identity/auth/common/guards/auth.guard.js';
import { RoleGuard } from '../../common/guards/role.guard.js';
import { Roles } from '../../common/decorators/roles-user.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';

@Controller('frequencies')
export class FrequenciesController {
  constructor(private readonly frequenciesService: FrequenciesService) {}

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateFrequencyDto) {
    return this.frequenciesService.create(dto);
  }
}
