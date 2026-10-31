import { IsInt, IsNotEmpty, IsPositive, IsString, Min } from 'class-validator';
import { IsPlate } from '../common/validators/is-placa.validator.js';
import { Transform } from 'class-transformer';

export class CreateBusDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsNotEmpty()
  @IsPlate()
  plate: string;

  @IsNotEmpty()
  @IsString()
  model: string;

  @IsInt()
  @Min(1000)
  year: number;

  @IsInt({ message: 'odometerKm debe ser un número entero' })
  @IsPositive({ message: 'odometerKm debe ser mayor a 0' })
  odometerKm: number;
}
