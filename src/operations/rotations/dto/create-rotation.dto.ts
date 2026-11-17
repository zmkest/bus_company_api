import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Weekday } from '../../../generated/prisma/enums.js';

export class RotationLegDto {
  @Type(() => Number)
  @IsInt({ message: 'legs.frequencyId: Debe ser un número entero' })
  @IsPositive({ message: 'legs.frequencyId: Debe ser mayor a 0' })
  frequencyId: number;

  @IsEnum(Weekday, { message: 'legs.weekday: Día no válido' })
  weekday: Weekday;
}

export class CreateRotationDto {
  @IsString({ message: 'name: Debe ser texto' })
  @IsNotEmpty({ message: 'name: Es obligatorio' })
  @MaxLength(100, { message: 'name: Máximo 100 caracteres' })
  name: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'busId: Debe ser un número entero' })
  @IsPositive({ message: 'busId: Debe ser mayor a 0' })
  busId?: number;

  @IsArray({ message: 'legs: Debe ser una lista' })
  @ArrayNotEmpty({ message: 'legs: Debe incluir al menos un tramo' })
  @ArrayMaxSize(100, { message: 'legs: No puede tener más de 100 tramos' })
  @ValidateNested({ each: true })
  @Type(() => RotationLegDto)
  legs: RotationLegDto[];
}
