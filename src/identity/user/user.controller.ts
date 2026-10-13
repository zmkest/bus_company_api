import { Controller, Get, Body, Patch, Param, Delete, UseGuards, ParseBoolPipe, ParseIntPipe } from '@nestjs/common';
import { UserService } from './user.service.js';
import { AuthGuard } from '../auth/common/guards/auth.guard.js';
import { RoleGuard } from '../../common/guards/role.guard.js';
import { Roles } from '../../common/decorators/roles-user.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(AuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUser: UpdateUserDto) {
    return this.userService.update(+id, updateUser);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/active')
  updateActive(
    @Param('id', ParseIntPipe) id: number, 
    @Body('isActive', ParseBoolPipe) isActive: boolean) {
    return this.userService.updateActive(id, isActive);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.userService.delete(id);
  }
  
}
