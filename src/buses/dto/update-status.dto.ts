import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { BusStatus, MaintenanceType } from '../../generated/prisma/enums.js';
import { toUpper, trim } from '../common/utils/string.util.js';

export class UpdateBusStatusDto {
  @Transform(toUpper)
  @IsEnum(BusStatus, { message: 'Estado de bus no válido' })
  status: BusStatus;

  @ValidateIf((o) => o.status === BusStatus.OUT_OF_SERVICE || o.status === BusStatus.MAINTENANCE)
  @Transform(trim)
  @IsString({ message: 'La razón debe ser un string' })
  @IsNotEmpty({ message: 'La razón para este cambio de estado es requerida' })
  @MaxLength(255, { message: 'La razón debe ser menor o igual a 255 caracteres' })
  reason?: string;

  // Apertura a mantenimiento
  @ValidateIf((o) => o.status === BusStatus.MAINTENANCE)
  @Transform(toUpper)
  @IsNotEmpty({ message: 'El tipo de mantenimiento es requerido' })
  @IsEnum(MaintenanceType, { message: 'Tipo de mantenimiento no válido' })
  type?: MaintenanceType;

  @ValidateIf((o) => o.status === BusStatus.MAINTENANCE)
  @Type(() => Date)
  @IsNotEmpty({ message: 'La fecha de inicio es requerida para el mantenimiento' })
  @IsDate({ message: 'startedAt debe ser una fecha válida' })
  startedAt?: Date;

  // Validación dentro del servicio
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El costo debe ser un número con máximo 2 decimales' },
  )
  @Min(0, { message: 'El costo no puede ser negativo' })
  cost?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'finishedAt debe ser una fecha válida' })
  finishedAt?: Date;
}
