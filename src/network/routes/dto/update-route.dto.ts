import { PartialType, PickType } from '@nestjs/mapped-types';
import { CreateRouteDto } from './create-route.dto.js';

export class UpdateRouteDto extends PartialType(
  PickType(CreateRouteDto, ['distanceKm', 'durationMinutes'] as const),
) {}
