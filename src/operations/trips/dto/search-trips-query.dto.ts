import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsPositive, Matches } from 'class-validator';

export class SearchTripsQueryDto {
  @Type(() => Number)
  @IsInt({ message: 'originCityId: Debe ser un número entero' })
  @IsPositive({ message: 'originCityId: Debe ser mayor a 0' })
  originCityId: number;

  @Type(() => Number)
  @IsInt({ message: 'destinationCityId: Debe ser un número entero' })
  @IsPositive({ message: 'destinationCityId: Debe ser mayor a 0' })
  destinationCityId: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date: Debe tener formato YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'date: No es una fecha válida' })
  date: string;
}
