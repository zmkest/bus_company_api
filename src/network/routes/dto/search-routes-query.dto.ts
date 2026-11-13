import { Type } from 'class-transformer';
import { IsInt, IsPositive } from 'class-validator';

export class SearchRoutesQueryDto {
  @Type(() => Number)
  @IsInt({ message: 'originCityId: Debe ser un número entero' })
  @IsPositive({ message: 'originCityId: Debe ser mayor a 0' })
  originCityId: number;

  @Type(() => Number)
  @IsInt({ message: 'destinationCityId: Debe ser un número entero' })
  @IsPositive({ message: 'destinationCityId: Debe ser mayor a 0' })
  destinationCityId: number;
}
