import { Transform } from "class-transformer";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { BusStatus } from "../../generated/prisma/enums.js";


export class UpdateBusStatusDto {
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim().toUpperCase() : value,
    )
    @IsEnum(BusStatus, { message: 'Estado de bus inconsistente'})
    status: BusStatus = BusStatus.AVAILABLE;

    @IsOptional()
    @IsString()
    @MaxLength(250)
    reason?: string;
}