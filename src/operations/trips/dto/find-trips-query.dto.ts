import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dtos/pagination-query.dto.js';
import { TripStatus } from '../../../generated/prisma/enums.js';

const SORT_BY_TRIP_VALID = ['id', 'scheduledDeparture', 'price'] as const;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class FindTripsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'routeId: Debe ser un número entero' })
  @IsPositive({ message: 'routeId: Debe ser mayor a 0' })
  routeId?: number;

  @IsOptional()
  @IsString({ message: 'busPlate: Debe ser texto' })
  @IsNotEmpty({ message: 'busPlate: No puede estar vacío' })
  busPlate?: string;

  @IsOptional()
  @IsEnum(TripStatus, { message: 'status: Estado no válido' })
  status?: TripStatus;

  @IsOptional()
  @Matches(DATE_ONLY, { message: 'from: Debe tener formato YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'from: No es una fecha válida' })
  from?: string;

  @IsOptional()
  @Matches(DATE_ONLY, { message: 'to: Debe tener formato YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'to: No es una fecha válida' })
  to?: string;

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean({ message: 'unassigned: Debe ser true o false' })
  unassigned?: boolean;

  @IsOptional()
  @IsIn(SORT_BY_TRIP_VALID, { message: 'La clave de ordenamiento no es válida' })
  sortBy: (typeof SORT_BY_TRIP_VALID)[number] = 'scheduledDeparture';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'asc';
}
