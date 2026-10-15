import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, ParseIntPipe } from '@nestjs/common';
import { BusesService } from './buses.service.js';
import { CreateBusDto } from './dto/create-bus.dto.js';
import { UpdateBusDto } from './dto/update-bus.dto.js';
import { AuthGuard } from '../identity/auth/common/guards/auth.guard.js';
import { RoleGuard } from '../common/guards/role.guard.js';
import { Roles } from '../common/decorators/roles-user.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { FindBusesQueryDto } from './dto/find-buses-query.dto.js';

@Controller('buses')
export class BusesController {
  constructor(private readonly busesService: BusesService) {}

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() createBusDto: CreateBusDto) {
    return this.busesService.create(createBusDto);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  findAll(@Query() query: FindBusesQueryDto) {
    return this.busesService.findAll(query);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.busesService.findOne(id);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateBusDto: UpdateBusDto) {
    return this.busesService.update(+id, updateBusDto);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.busesService.remove(id);
  }
}
