import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MaintenancesService } from './maintenances.service.js';
import { FindMaintenanceQueryDto } from './dto/find-maintenances-query.dto.js';
import { AuthGuard } from '../../identity/auth/common/guards/auth.guard.js';
import { RoleGuard } from '../../common/guards/role.guard.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { Roles } from '../../common/decorators/roles-user.decorator.js';
import { CompleteMaintenanceDto, UpdateMaintenanceDto } from './dto/update-maintenance.dto.js';
import { CurrentUserId } from '../../common/decorators/current-user.decorator.js';

@Controller('maintenances')
export class MaintenancesController {
  constructor(private readonly maintenancesService: MaintenancesService) {}

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.DRIVER, UserRole.OPERATOR)
  @Get()
  findAll(@Query() query: FindMaintenanceQueryDto) {
    return this.maintenancesService.getAll(query);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Get('count/status')
  countByStatus() {
    return this.maintenancesService.countByStatus();
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Get('count/type')
  countByType() {
    return this.maintenancesService.countByType();
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMaintenanceDto) {
    return this.maintenancesService.update(id, dto);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Patch(':id/complete')
  complete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserId() userId: number,
    @Body() dto: CompleteMaintenanceDto,
  ) {
    return this.maintenancesService.complete(id, userId, dto.startedAt);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Patch(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUserId() userId: number) {
    return this.maintenancesService.cancel(id, userId);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.maintenancesService.findOne(id);
  }
}
