import { IsEmail, IsEnum, IsString } from "class-validator";
import { UserRole } from "../../../generated/prisma/enums.js";

export class CreateUserDto {
    @IsEmail({}, {message: 'El email no es válido'})
    email: string;

    @IsString()
    name: string;

    @IsEnum(UserRole, { message: 'Este rol no es válido'})
    role: UserRole;
}