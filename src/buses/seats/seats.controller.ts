import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SeatsService } from './seats.service.js';
import { CreateManySeatsDto } from './dto/create-many.dto.js';
import { AuthGuard } from '../../identity/auth/common/guards/auth.guard.js';
import { RoleGuard } from '../../common/guards/role.guard.js';
import { Roles } from '../../common/decorators/roles-user.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { DeleteManySeatsDto } from './dto/delete-many.dto.js';
import { FindSeatsQueryDto } from './dto/find-query.dto.js';

@Controller('seats')
export class SeatsController {
  constructor(private readonly seatsService: SeatsService) {}

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Post('bus/:id')
  addSeat(@Param('id', ParseIntPipe) busId: number) {
    return this.seatsService.addSeat(busId);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Post('bus/:id/seats')
  createMany(@Param('id', ParseIntPipe) busId: number, @Body() body: CreateManySeatsDto) {
    const { totalSeats } = body;
    return this.seatsService.createMany(busId, totalSeats);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Delete('bus/:id/seats')
  trimSeats(@Param('id', ParseIntPipe) busId: number, @Body() body: DeleteManySeatsDto) {
    const { keep } = body;
    return this.seatsService.trimSeats(busId, keep);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SELLER)
  @Get('bus')
  findAll(@Query() query: FindSeatsQueryDto) {
    return this.seatsService.findAll(query);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SELLER)
  @Get('bus/:id')
  getSeatsByBusId(@Param('id', ParseIntPipe) busId: number) {
    return this.seatsService.findSeatsByBusId(busId);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Patch(':id/operational')
  updateIsOperational(
    @Param('id', ParseIntPipe) id: number,
    @Body('operational', ParseBoolPipe) isOperational: boolean,
  ) {
    return this.seatsService.updateIsOperational(id, isOperational);
  }
}
