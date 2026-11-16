import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsPositive,
  Matches,
  Max,
} from 'class-validator';
import { Weekday } from '../../../generated/prisma/enums.js';

export class CreateFrequencyDto {
  @Type(() => Number)
  @IsInt({ message: 'routeId: Debe ser un número entero' })
  @IsPositive({ message: 'routeId: Debe ser mayor a 0' })
  routeId: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'departureTime: Debe tener formato HH:mm (00:00 - 23:59)',
  })
  departureTime: string;

  @IsArray({ message: 'weekdays: Debe ser una lista' })
  @ArrayNotEmpty({ message: 'weekdays: Debe incluir al menos un día' })
  @ArrayMaxSize(7, { message: 'weekdays: No puede tener más de 7 días' })
  @ArrayUnique({ message: 'weekdays: No puede tener días repetidos' })
  @IsEnum(Weekday, { each: true, message: 'weekdays: Contiene un día no válido' })
  weekdays: Weekday[];

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'basePrice: Debe ser un número (máx. 2 decimales)' },
  )
  @IsPositive({ message: 'basePrice: Debe ser mayor a 0' })
  @Max(99999999.99, { message: 'basePrice: Excede el valor máximo permitido' })
  basePrice: number;
}
