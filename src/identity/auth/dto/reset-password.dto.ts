import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PWD_REGEX } from '../common/regex.const.js';

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8, { message: 'newPwd debe tener almenos 8 caracteres' })
  @MaxLength(72, { message: 'newPwd no debe tener más de 72 caracteres' })
  @Matches(PWD_REGEX, {
    message: 'Debe incluir mayúscula, minúscula y número',
  })
  newPwd: string;

  @IsString()
  repitNewPwd: string;
}
