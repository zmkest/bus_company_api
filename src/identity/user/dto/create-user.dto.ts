import { IsEmail, IsEnum, IsString, MinLength, minLength } from "class-validator";
import { UserRole } from "../../../generated/prisma/enums.js";
import { Transform } from "class-transformer";

export class CreateUserDto {
    @IsEmail()
    email: string;

    @IsString()
    name: string;
}