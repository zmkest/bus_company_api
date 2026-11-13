import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { RoutesService } from './routes.service.js';
import { CreateRouteDto } from './dto/create-route.dto.js';
import { AuthGuard } from '../../identity/auth/common/guards/auth.guard.js';
import { RoleGuard } from '../../common/guards/role.guard.js';
import { Roles } from '../../common/decorators/roles-user.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';

@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateRouteDto) {
    return this.routesService.create(dto);
  }
}
