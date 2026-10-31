import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateBusDto } from './create-bus.dto.js';
import { ValidateIf } from 'class-validator';

export class UpdateBusDto extends PartialType(OmitType(CreateBusDto, ['plate'] as const)) {
  @ValidateIf((_, value) => value !== undefined)
  odometerKm?: number;
}
