import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty } from 'class-validator';
import { IsAfter } from '../../common/decorators/compare-date.decorator.js';

export class AvailableWithoutTripDto {
  @Type(() => Date)
  @IsNotEmpty({ message: 'startDate no debe ser vacio' })
  @IsDate({ message: 'startDate no es una fecha válida' })
  startDate: Date;

  @Type(() => Date)
  @IsNotEmpty({ message: 'finishDate no debe ser vacio' })
  @IsDate({ message: 'finishDate no es una fecha válida' })
  @IsAfter('startDate', { message: 'finishDate debe ser posterior a startDate' })
  finishDate: Date;
}
