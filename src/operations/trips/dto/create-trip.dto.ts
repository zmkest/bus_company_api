import { Type } from 'class-transformer';
import { IsDate, IsInt, IsNumber, IsPositive, MinDate, Max } from 'class-validator';

export class CreateTripDto {
  @Type(() => Number)
  @IsInt({ message: 'routeId: Debe ser un número entero' })
  @IsPositive({ message: 'routeId: Debe ser mayor a 0' })
  routeId: number;

  @Type(() => Number)
  @IsInt({ message: 'busId: Debe ser un número entero' })
  @IsPositive({ message: 'busId: Debe ser mayor a 0' })
  busId: number;

  @Type(() => Date)
  @IsDate({ message: 'scheduledDeparture: No es una fecha válida' })
  @MinDate(() => new Date(), { message: 'scheduledDeparture: Debe ser una fecha futura' })
  scheduledDeparture: Date;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'price: Debe ser un número (máx. 2 decimales)' })
  @IsPositive({ message: 'price: Debe ser mayor a 0' })
  @Max(99999999.99, { message: 'price: Excede el valor máximo permitido' })
  price: number;
}
