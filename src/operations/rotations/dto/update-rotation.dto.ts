import { PartialType, PickType } from '@nestjs/mapped-types';
import { CreateRotationDto } from './create-rotation.dto.js';

export class UpdateRotationDto extends PartialType(
  PickType(CreateRotationDto, ['name', 'legs'] as const),
) {}
