import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { trim } from '../../common/utils/string.util.js';
import { PaginationQueryDto } from '../../../common/dtos/pagination-query.dto.js';

export const BUSES_SORT_FIELDS = ['createdAt', 'odometerKm', 'year', 'status'] as const;

export class FindSeatsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'search: deberia ser un string' })
  @MaxLength(100, { message: 'search: debe contener un máximo de 100 caracteres' })
  search?: string;

  @IsOptional()
  @IsIn(BUSES_SORT_FIELDS)
  sortBy: (typeof BUSES_SORT_FIELDS)[number] = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
