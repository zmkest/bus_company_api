import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TripsService } from './trips.service.js';
import { CreateTripDto } from './dto/create-trip.dto.js';
import { GenerateTripsDto } from './dto/generate-trips.dto.js';
import { AssignBusDto } from './dto/assign-bus.dto.js';
import { FindTripsQueryDto } from './dto/find-trips-query.dto.js';
import { AuthGuard } from '../../identity/auth/common/guards/auth.guard.js';
import { RoleGuard } from '../../common/guards/role.guard.js';
import { Roles } from '../../common/decorators/roles-user.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';

@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Post()
  create(@Body() dto: CreateTripDto) {
    return this.tripsService.create(dto);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Get()
  findAll(@Query() query: FindTripsQueryDto) {
    return this.tripsService.findAll(query);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Post('generate')
  generate(@Body() dto: GenerateTripsDto) {
    return this.tripsService.generate(dto);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Patch(':id/bus')
  assignBus(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignBusDto) {
    return this.tripsService.assignBus(id, dto.busId);
  }
}
