import { Controller, Get, Body, Patch, Param, Delete, UseGuards, ParseBoolPipe, ParseIntPipe, Query } from '@nestjs/common';
import { UserService } from './user.service.js';
import { AuthGuard } from '../auth/common/guards/auth.guard.js';
import { RoleGuard } from '../../common/guards/role.guard.js';
import { Roles } from '../../common/decorators/roles-user.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { FindUsersQueryDto } from './dto/find-users-query.dto.js';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateUser: UpdateUserDto) {
    return this.userService.update(id, updateUser);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/active')
  updateActive(
    @Param('id', ParseIntPipe) id: number,
    @Body('isActive', ParseBoolPipe) isActive: boolean) {
    return this.userService.updateActive(id, isActive);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  findAll(@Query() query: FindUsersQueryDto) {
    return this.userService.findAll(query);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  @Get('count')
  count() {
    return this.userService.count();
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  @Get('count/active/:isActive')
  countIsActive(@Param('isActive', ParseBoolPipe) isActive: boolean) {
    return this.userService.countIsActive(isActive);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne(id);
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.userService.delete(id);
  }

}
