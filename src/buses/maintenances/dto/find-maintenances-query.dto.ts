import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dtos/pagination-query.dto.js';
import { Transform } from 'class-transformer';

const MAINTENANCES_SORT_FIELDS = ['createdAt', 'startedAt', 'finishedAt', 'plate'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

@ValidatorConstraint({ name: 'isDateRange', async: false })
class IsDataRangeConstraint implements ValidatorConstraintInterface {
  validate(endDate: string, args: ValidationArguments): Promise<boolean> | boolean {
    const { startDate } = args.object as FindMaintenanceQueryDto;
    if (!startDate || !endDate) return true;
    return startDate <= endDate;
  }

  defaultMessage(): string {
    return 'endDate debe ser mayor o igual a startDate';
  }
}

export class FindMaintenanceQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MaxLength(100, { message: 'Máximo de caracteres de búsqueda alcanzado' })
  search?: string;

  @IsOptional()
  @IsIn(MAINTENANCES_SORT_FIELDS)
  sortBy: (typeof MAINTENANCES_SORT_FIELDS)[number] = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @Matches(DATE_REGEX, { message: 'startDate debe tener formato YYYY-MM-DD' })
  startDate?: string;

  @IsOptional()
  @Matches(DATE_REGEX, { message: 'endDate debe tener formato YYYY-MM-DD' })
  @Validate(IsDataRangeConstraint)
  endDate?: string;
}
