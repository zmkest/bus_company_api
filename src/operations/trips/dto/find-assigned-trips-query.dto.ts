import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { TripStatus } from '../../../generated/prisma/enums.js';
import { PaginationQueryDto } from '../../../common/dtos/pagination-query.dto.js';

const SORT_BY_TRIP_VALID = ['id', 'scheduledDeparture'] as const;

export class FindAssignedTripsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(TripStatus, { message: 'status: Estado no válido' })
  status?: TripStatus;

  @IsOptional()
  @IsIn(SORT_BY_TRIP_VALID, { message: 'La clave de ordenamiento no es válida' })
  sortBy: (typeof SORT_BY_TRIP_VALID)[number] = 'scheduledDeparture';

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'order: La clave de ordenamiento no es válida' })
  order: 'asc' | 'desc' = 'asc';
}
