import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Max,
  MinDate,
  ValidateIf,
} from 'class-validator';

export class UpdateTripDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'scheduledDeparture: No es una fecha válida' })
  @MinDate(() => new Date(), { message: 'scheduledDeparture: Debe ser una fecha futura' })
  scheduledDeparture?: Date;

  @ValidateIf((o: UpdateTripDto) => o.busId !== undefined && o.busId !== null)
  @IsInt({ message: 'busId: Debe ser un número entero o null' })
  @IsPositive({ message: 'busId: Debe ser mayor a 0' })
  busId?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'price: Debe ser un número (máx. 2 decimales)' })
  @IsPositive({ message: 'price: Debe ser mayor a 0' })
  @Max(99999999.99, { message: 'price: Excede el valor máximo permitido' })
  price?: number;
}
