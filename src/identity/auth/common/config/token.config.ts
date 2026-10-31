import { JwtSignOptions } from '@nestjs/jwt';
import { envs } from '../../../../config/envs.js';

export enum TokenType {
  REFRESH = 'refresh',
  RESET = 'reset',
  NEW_USER = 'new_user',
}

export interface TokenConfig {
  secret: string;
  expiresIn: JwtSignOptions['expiresIn'];
  issuer?: string;
  audience?: string;
}

export const TOKEN_CONFIG: Record<TokenType, TokenConfig> = {
  [TokenType.REFRESH]: {
    secret: envs.jwt_refresh_token,
    expiresIn: '7d',
  },
  [TokenType.RESET]: {
    secret: envs.jwt_pwd_reset_secret,
    expiresIn: '15m',
    issuer: envs.jwt_pwd_reset_issuer,
    audience: envs.jwt_pwd_reset_audience,
  },
  [TokenType.NEW_USER]: {
    secret: envs.jwt_pwd_setup_secret,
    expiresIn: '15m',
    issuer: envs.jwt_pwd_setup_issuer,
    audience: envs.jwt_pwd_setup_audience,
  },
};
