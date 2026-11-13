import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsPositive, Max } from 'class-validator';

export class CreateRouteDto {
  @Type(() => Number)
  @IsInt({ message: 'originId: Debe ser un número entero' })
  @IsPositive({ message: 'originId: Debe ser mayor a 0' })
  originId: number;

  @Type(() => Number)
  @IsInt({ message: 'destinationId: Debe ser un número entero' })
  @IsPositive({ message: 'destinationId: Debe ser mayor a 0' })
  destinationId: number;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'distanceKm: Debe ser un número (máx. 2 decimales)' },
  )
  @IsPositive({ message: 'distanceKm: Debe ser mayor a 0' })
  @Max(10000, { message: 'distanceKm: No puede exceder 10000 km' })
  distanceKm: number;

  @Type(() => Number)
  @IsInt({ message: 'durationMinutes: Debe ser un número entero' })
  @IsPositive({ message: 'durationMinutes: Debe ser mayor a 0' })
  @Max(10080, { message: 'durationMinutes: No puede exceder 10080 minutos (7 días)' })
  durationMinutes: number;
}
