import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxDate,
  MaxLength,
  Min,
} from 'class-validator';
import { MaintenanceType } from '../../../generated/prisma/enums.js';
import { Transform, Type } from 'class-transformer';
import { toUpper, trim } from '../../common/utils/string.util.js';

export class UpdateMaintenanceDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'busId debe ser un número' })
  @Min(1, { message: 'El identificador del bus inválido' })
  busId: number;

  @IsOptional()
  @Transform(toUpper)
  @IsEnum(MaintenanceType, { message: 'Este tipo de mantenimiento no es válido' })
  type?: MaintenanceType;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @Type(() => Date)
  @IsNotEmpty({ message: 'La fecha de inicio es requerida para el mantenimiento' })
  @IsDate({ message: 'startedAt debe ser una fecha válida' })
  @MaxDate(() => new Date(), {
    message: 'startedAt no debe ser mayor a la fecha actual',
  })
  startedAt?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El costo debe ser un número con máximo 2 decimales' },
  )
  @Min(0, { message: 'El costo no puede ser negativo' })
  cost?: number;
}

export class CompleteMaintenanceDto {
  @Type(() => Date)
  @IsDate({ message: 'startedAt debe ser una fecha válida (ej: 2026-10-29T08:00:00Z)' })
  @MaxDate(() => new Date(), { message: 'startedAt no debe ser una fecha futura' })
  startedAt: Date;
}
