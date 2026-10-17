import { IsNotEmpty, IsNumber, IsString, Min } from "class-validator";
import { IsPlate } from "../common/validators/is-placa.validator.js";
import { Transform } from "class-transformer";

export class CreateBusDto {
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim().toUpperCase() : value,
    )
    @IsNotEmpty()
    @IsPlate()
    plate: string;

    @IsNotEmpty()
    @IsString()
    model: string;

    @IsNumber()
    @Min(1000)
    year: number;

    @IsNumber()
    odometerKm: number;
}
