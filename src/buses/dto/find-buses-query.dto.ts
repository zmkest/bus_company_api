import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dtos/pagination-query.dto.js';
import { Transform } from 'class-transformer';

export const BUSES_SORT_FIELDS = ['createdAt', 'odometerKm', 'year', 'status'] as const;

export class FindBusesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(BUSES_SORT_FIELDS)
  sortBy: (typeof BUSES_SORT_FIELDS)[number] = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
