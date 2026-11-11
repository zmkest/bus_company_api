import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dtos/pagination-query.dto.js';
import { Transform } from 'class-transformer';
import { trim } from '../../../buses/common/utils/string.util.js';

const SORT_BY_TERMINAL_VALID = ['name', 'cityId'];
export class FindTerminalQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100, { message: 'La búsqueda excede los limites de caracteres necesarios' })
  search: string;

  @IsOptional()
  @IsIn(SORT_BY_TERMINAL_VALID, { message: 'La clave de ordernamiento no es válida' })
  sortBy: (typeof SORT_BY_TERMINAL_VALID)[number] = 'name';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
