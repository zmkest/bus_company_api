import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty } from 'class-validator';
import { IsAfter } from '../decorators/compare-date.decorator.js';

export class QueryDateRangeDto {
  @Type(() => Date)
  @IsNotEmpty({ message: 'startDate no debe ser vacio' })
  @IsDate({ message: 'startDate no es una fecha válida' })
  startDate: Date;

  @Type(() => Date)
  @IsNotEmpty({ message: 'endDate no debe ser vacio' })
  @IsDate({ message: 'endDate no es una fecha válida' })
  @IsAfter('startDate', { message: 'endDate debe ser posterior a startDate' })
  endDate: Date;
}
