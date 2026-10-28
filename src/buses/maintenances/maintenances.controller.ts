import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MaintenancesService } from './maintenances.service.js';
import { FindMaintenanceQueryDto } from './dto/find-maintenances-query.dto.js';
import { AuthGuard } from '../../identity/auth/common/guards/auth.guard.js';
import { RoleGuard } from '../../common/guards/role.guard.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { Roles } from '../../common/decorators/roles-user.decorator.js';

@Controller('maintenances')
export class MaintenancesController {
  constructor(private readonly maintenancesService: MaintenancesService) {}

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.DRIVER, UserRole.OPERATOR)
  @Get()
  findAll(@Query() query: FindMaintenanceQueryDto) {
    return this.maintenancesService.getAll(query);
  }
}
