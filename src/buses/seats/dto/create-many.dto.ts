import { IsInt, Max, Min } from 'class-validator';

export class CreateManySeatsDto {
  @IsInt()
  @Min(2, { message: 'El número de asientos debe ser al menos 2' })
  @Max(80, { message: 'El número de asientos no puede ser mayor a 80' })
  totalSeats: number;
}
