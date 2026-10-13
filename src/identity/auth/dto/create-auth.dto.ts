import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from "class-validator";
import { Transform } from "class-transformer";
import { EUserRole } from "../common/enums.common.js";

export class CreateAuthDto {
    @IsEmail()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    passwordHash: string;

    @IsString()
    @IsNotEmpty()
    name: string;
}