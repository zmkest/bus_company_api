import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
  ParseEnumPipe,
} from '@nestjs/common';
import { BusesService } from './buses.service.js';
import { CreateBusDto } from './dto/create-bus.dto.js';
import { UpdateBusDto } from './dto/update-bus.dto.js';
import { AuthGuard } from '../identity/auth/common/guards/auth.guard.js';
import { RoleGuard } from '../common/guards/role.guard.js';
import { Roles } from '../common/decorators/roles-user.decorator.js';
import { BusStatus, UserRole } from '../generated/prisma/enums.js';
import { FindBusesQueryDto } from './dto/find-buses-query.dto.js';
import { CurrentUserId } from '../common/decorators/current-user.decorator.js';
import { UpdateBusStatusDto } from './dto/update-status.dto.js';

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
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateBusDto: UpdateBusDto) {
    return this.busesService.update(id, updateBusDto);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Patch(':id/status')
  updateAndStatusHistory(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBusDto: UpdateBusStatusDto,
    @CurrentUserId() userId: number,
  ) {
    return this.busesService.updateStatusAndHistory(id, updateBusDto, userId);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.busesService.remove(id);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  @Get('count')
  count() {
    return this.busesService.count();
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  @Get('count/status/:status')
  countStatus(@Param('status', new ParseEnumPipe(BusStatus)) status: BusStatus) {
    return this.busesService.countStatus(status);
  }
}
