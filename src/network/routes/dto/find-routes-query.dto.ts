import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsPositive } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dtos/pagination-query.dto.js';

const SORT_BY_ROUTE_VALID = ['id', 'distanceKm', 'durationMinutes'] as const;

export class FindRoutesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'originCityId: Debe ser un número entero' })
  @IsPositive({ message: 'originCityId: Debe ser mayor a 0' })
  originCityId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'destinationCityId: Debe ser un número entero' })
  @IsPositive({ message: 'destinationCityId: Debe ser mayor a 0' })
  destinationCityId?: number;

  @IsOptional()
  @IsIn(SORT_BY_ROUTE_VALID, { message: 'La clave de ordenamiento no es válida' })
  sortBy: (typeof SORT_BY_ROUTE_VALID)[number] = 'id';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
