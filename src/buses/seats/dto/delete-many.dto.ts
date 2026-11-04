import { IsInt, Max, Min } from 'class-validator';

export class DeleteManySeatsDto {
  @IsInt()
  @Min(2, { message: 'keep debe ser al menos 2' })
  @Max(80, { message: 'keep no puede ser mayor a 80' })
  keep: number;
}
