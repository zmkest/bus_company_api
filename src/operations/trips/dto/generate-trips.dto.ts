import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsPositive,
  Matches,
} from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class GenerateTripsDto {
  @Matches(DATE_ONLY, { message: 'from: Debe tener formato YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'from: No es una fecha válida' })
  from: string;

  @Matches(DATE_ONLY, { message: 'to: Debe tener formato YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'to: No es una fecha válida' })
  to: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'routeId: Debe ser un número entero' })
  @IsPositive({ message: 'routeId: Debe ser mayor a 0' })
  routeId?: number;

  @IsOptional()
  @IsArray({ message: 'frequencyIds: Debe ser una lista' })
  @ArrayNotEmpty({ message: 'frequencyIds: Debe incluir al menos un id' })
  @ArrayUnique({ message: 'frequencyIds: No puede tener ids repetidos' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'frequencyIds: Cada id debe ser un número entero' })
  @IsPositive({ each: true, message: 'frequencyIds: Cada id debe ser mayor a 0' })
  frequencyIds?: number[];
}
