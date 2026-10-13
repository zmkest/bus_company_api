import { Transform } from "class-transformer";
import { IsEmail, IsEnum, IsString } from "class-validator";
import { UserRole } from "../../../generated/prisma/enums.js";

export class CreateUserByAdminDto {
    @IsEmail()
    email: string;

    @IsString()
    name: string;

    @Transform(({value}) => value.toUppercase())
    @IsEnum(UserRole, { message: 'This role is invalid'})
    role: UserRole;
}