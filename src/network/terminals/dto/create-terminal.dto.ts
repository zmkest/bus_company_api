import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { trim } from '../../../buses/common/utils/string.util.js';

export class CreateTerminalDto {
  @Transform(trim)
  @IsString()
  @MaxLength(150, { message: 'name: Excede los 150 caracteres' })
  @IsNotEmpty({ message: 'name: No puede ser vacio' })
  name: string;

  @Type(() => Number)
  @IsInt({ message: 'cityId: Debe ser un número' })
  @IsPositive({ message: 'cityId: Debe ser mayor a 0' })
  cityId: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(250, { message: 'address: Excede los 250 carcateres' })
  @IsNotEmpty({ message: 'address: No puede ser vacio' })
  address?: string;
}
