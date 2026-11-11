import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { TerminalsService } from './terminals.service.js';
import { CreateTerminalDto } from './dto/create-terminal.dto.js';
import { AuthGuard } from '../../identity/auth/common/guards/auth.guard.js';
import { RoleGuard } from '../../common/guards/role.guard.js';
import { Roles } from '../../common/decorators/roles-user.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';

@Controller('terminals')
export class TerminalsController {
  constructor(private readonly terminalsService: TerminalsService) {}

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Post()
  create(@Body() dto: CreateTerminalDto) {
    return this.terminalsService.create(dto);
  }
}
