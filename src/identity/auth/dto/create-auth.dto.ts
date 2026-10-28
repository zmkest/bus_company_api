import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateAuthDto {
  @IsEmail({}, { message: 'El correo no es válido' })
  email: string;

  @IsString({ message: 'La contraseña debería ser un string' })
  @IsNotEmpty({ message: 'La contraseña no debe estar vacia' })
  @MinLength(6, { message: 'La contraseña debe tener mas de 6 caracteres' })
  password: string;

  @IsString({ message: 'El nombre debería ser un string' })
  @IsNotEmpty({ message: 'El nombre no debe estar vacio' })
  name: string;
}
