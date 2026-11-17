import {
  IsDefined,
  IsInt,
  IsISO8601,
  IsOptional,
  IsPositive,
  Matches,
  ValidateIf,
} from 'class-validator';

export class ChangeRotationBusDto {
  @ValidateIf((o: ChangeRotationBusDto) => o.busId !== null)
  @IsDefined({ message: 'busId: Es obligatorio (id del bus o null para quitarlo)' })
  @IsInt({ message: 'busId: Debe ser un número entero o null' })
  @IsPositive({ message: 'busId: Debe ser mayor a 0' })
  busId: number | null;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'applyFrom: Debe tener formato YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'applyFrom: No es una fecha válida' })
  applyFrom?: string;
}
