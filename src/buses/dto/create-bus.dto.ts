import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { BusStatus } from "../../generated/prisma/enums.js";
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

    @IsOptional()
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim().toUpperCase() : value,
    )
    @IsEnum(BusStatus, { message: 'Estado de bus inconsistente'})
    status: BusStatus = BusStatus.AVAILABLE;
}
