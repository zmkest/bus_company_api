import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { PWD_REGEX } from '../common/regex.const.js';

export class CreateAuthDto {
  @IsEmail({}, { message: 'El correo no es válido' })
  email: string;

  @IsString({ message: 'La contraseña debería ser un string' })
  @IsNotEmpty({ message: 'La contraseña no debe estar vacia' })
  @MinLength(6, { message: 'La contraseña debe tener mas de 6 caracteres' })
  password: string;
  @Matches(PWD_REGEX, {
    message: 'Debe incluir mayúscula, minúscula y número',
  })
  @IsString({ message: 'El nombre debería ser un string' })
  @IsNotEmpty({ message: 'El nombre no debe estar vacio' })
  name: string;
}
