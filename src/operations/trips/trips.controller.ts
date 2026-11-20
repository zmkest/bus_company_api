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
import { UpdateTripDto } from './dto/update-trip.dto.js';
import { FindTripsQueryDto } from './dto/find-trips-query.dto.js';
import { SearchTripsQueryDto } from './dto/search-trips-query.dto.js';
import { AuthGuard } from '../../identity/auth/common/guards/auth.guard.js';
import { RoleGuard } from '../../common/guards/role.guard.js';
import { Roles } from '../../common/decorators/roles-user.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { CurrentUserId } from '../../common/decorators/current-user.decorator.js';
import { CurrentUserRole } from '../../common/decorators/current-user-role.decorator.js';

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
  @Get('count/status')
  countByStatus() {
    return this.tripsService.countByStatus();
  }

  @Get('search')
  search(@Query() query: SearchTripsQueryDto) {
    return this.tripsService.search(query);
  }

  @Get(':id/seats')
  seatMap(@Param('id', ParseIntPipe) id: number) {
    return this.tripsService.seatMap(id);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.DRIVER)
  @Get(':id/manifest')
  manifest(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserId() userId: number,
    @CurrentUserRole() role: UserRole,
  ) {
    return this.tripsService.manifest(id, userId, role);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tripsService.findOne(id);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Post('generate')
  generate(@Body() dto: GenerateTripsDto) {
    return this.tripsService.generate(dto);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTripDto) {
    return this.tripsService.update(id, dto);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Patch(':id/bus')
  assignBus(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignBusDto) {
    return this.tripsService.assignBus(id, dto.busId);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.DRIVER)
  @Patch(':id/start')
  start(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserId() userId: number,
    @CurrentUserRole() role: UserRole,
  ) {
    return this.tripsService.start(id, userId, role);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.DRIVER)
  @Patch(':id/complete')
  complete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserId() userId: number,
    @CurrentUserRole() role: UserRole,
  ) {
    return this.tripsService.complete(id, userId, role);
  }
}
