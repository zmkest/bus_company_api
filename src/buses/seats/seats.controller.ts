import { Body, Controller, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { SeatsService } from './seats.service.js';
import { CreateManySeatsDto } from './dto/create-many.dto.js';
import { AuthGuard } from '../../identity/auth/common/guards/auth.guard.js';
import { RoleGuard } from '../../common/guards/role.guard.js';
import { Roles } from '../../common/decorators/roles-user.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';

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
}
