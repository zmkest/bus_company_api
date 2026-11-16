import { PartialType, PickType } from '@nestjs/mapped-types';
import { CreateFrequencyDto } from './create-frequency.dto.js';

export class UpdateFrequencyDto extends PartialType(
  PickType(CreateFrequencyDto, ['departureTime', 'weekdays', 'basePrice'] as const),
) {}
