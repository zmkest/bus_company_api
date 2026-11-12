import { PartialType } from '@nestjs/mapped-types';
import { CreateTerminalDto } from './create-terminal.dto.js';

export class UpdateTerminalDto extends PartialType(CreateTerminalDto) {}
