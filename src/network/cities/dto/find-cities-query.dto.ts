import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { trim } from '../../../buses/common/utils/string.util.js';

export class FindCitiesQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100, { message: 'search: Excede los 100 caracteres' })
  search?: string;

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean({ message: 'withTerminals: Debe ser true o false' })
  withTerminals?: boolean;
}
