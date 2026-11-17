import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsPositive } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dtos/pagination-query.dto.js';

const SORT_BY_ROTATION_VALID = ['id', 'name', 'createdAt'] as const;

export class FindRotationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'busId: Debe ser un número entero' })
  @IsPositive({ message: 'busId: Debe ser mayor a 0' })
  busId?: number;

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean({ message: 'isActive: Debe ser true o false' })
  isActive?: boolean;

  @IsOptional()
  @IsIn(SORT_BY_ROTATION_VALID, { message: 'La clave de ordenamiento no es válida' })
  sortBy: (typeof SORT_BY_ROTATION_VALID)[number] = 'id';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'asc';
}
