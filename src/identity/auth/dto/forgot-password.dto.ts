import { IsEmail, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @IsString()
  @IsEmail({}, { message: 'No es un email válido' })
  email: string;
}
