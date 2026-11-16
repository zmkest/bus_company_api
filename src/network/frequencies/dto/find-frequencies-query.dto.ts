import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsPositive } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dtos/pagination-query.dto.js';
import { Weekday } from '../../../generated/prisma/enums.js';

const SORT_BY_FREQUENCY_VALID = ['id', 'departureTime', 'basePrice'] as const;

export class FindFrequenciesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'routeId: Debe ser un número entero' })
  @IsPositive({ message: 'routeId: Debe ser mayor a 0' })
  routeId?: number;

  @IsOptional()
  @IsEnum(Weekday, { message: 'weekday: Día no válido' })
  weekday?: Weekday;

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean({ message: 'isActive: Debe ser true o false' })
  isActive?: boolean;

  @IsOptional()
  @IsIn(SORT_BY_FREQUENCY_VALID, { message: 'La clave de ordenamiento no es válida' })
  sortBy: (typeof SORT_BY_FREQUENCY_VALID)[number] = 'departureTime';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'asc';
}
