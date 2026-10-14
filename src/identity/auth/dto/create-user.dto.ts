import { Transform } from "class-transformer";
import { IsEmail, IsEnum, IsString } from "class-validator";
import { UserRole } from "../../../generated/prisma/enums.js";

export class CreateUserByAdminDto {
    @IsEmail({}, { message: 'El email no es valido'})
    email: string;

    @IsString({ message: 'El nombre debe ser un string'})
    name: string;

    @Transform(({value}) => value.toUppercase())
    @IsEnum(UserRole, { message: 'Este rol no es válido'})
    role: UserRole;
}