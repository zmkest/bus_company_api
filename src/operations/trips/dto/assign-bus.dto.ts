import { IsDefined, IsInt, IsPositive, ValidateIf } from 'class-validator';

export class AssignBusDto {
  @ValidateIf((o: AssignBusDto) => o.busId !== null)
  @IsDefined({ message: 'busId: Es obligatorio (id del bus o null para quitarlo)' })
  @IsInt({ message: 'busId: Debe ser un número entero o null' })
  @IsPositive({ message: 'busId: Debe ser mayor a 0' })
  busId: number | null;
}
