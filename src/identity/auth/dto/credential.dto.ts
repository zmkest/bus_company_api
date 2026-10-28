import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CredentialsDto {
  @IsEmail({}, { message: 'El email no es valido' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña no debe estar vacia' })
  @MinLength(6, { message: 'La contraseña debe tener más de 6 caracteres' })
  password: string;
}
