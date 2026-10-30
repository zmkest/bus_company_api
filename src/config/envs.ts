import 'dotenv/config';
import joi from 'joi';

interface EnvVars {
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  FRONTEND_URL: string;
  JWT_PWD_SETUP_SECRET: string;
  JWT_PWD_SETUP_PURPOSE: string;
  JWT_PWD_SETUP_ISSUER: string;
  JWT_PWD_SETUP_AUDIENCE: string;
  JWT_PWD_RESET_SECRET: string;
  JWT_PWD_RESET_PURPOSE: string;
  JWT_PWD_RESET_ISSUER: string;
  JWT_PWD_RESET_AUDIENCE: string;
  RESEND_API_KEY: string;
  RESEND_EMAIL: string;
}

const envsSchema = joi
  .object({
    PORT: joi.number().default(3000),
    DATABASE_URL: joi.string().required(),
    JWT_SECRET: joi.string().required(),
    JWT_REFRESH_SECRET: joi.string().required(),
    FRONTEND_URL: joi.string().required(),
    JWT_PWD_SETUP_SECRET: joi.string().required(),
    JWT_PWD_SETUP_PURPOSE: joi.string().required(),
    JWT_PWD_SETUP_ISSUER: joi.string().required(),
    JWT_PWD_SETUP_AUDIENCE: joi.string().required(),
    JWT_PWD_RESET_SECRET: joi.string().required(),
    JWT_PWD_RESET_PURPOSE: joi.string().required(),
    JWT_PWD_RESET_ISSUER: joi.string().required(),
    JWT_PWD_RESET_AUDIENCE: joi.string().required(),
    RESEND_API_KEY: joi.string().required(),
    RESEND_EMAIL: joi.string().required(),
  })
  .unknown(true);

const { error, value } = envsSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const envVars: EnvVars = value;

export const envs = {
  port: envVars.PORT,
  databaseUrl: envVars.DATABASE_URL,
  jwt_secret: envVars.JWT_SECRET,
  jwt_refresh_token: envVars.JWT_REFRESH_SECRET,
  frontend_url: envVars.FRONTEND_URL,
  jwt_pwd_setup_secret: envVars.JWT_PWD_SETUP_SECRET,
  jwt_pwd_setup_purpose: envVars.JWT_PWD_SETUP_PURPOSE,
  jwt_pwd_setup_issuer: envVars.JWT_PWD_SETUP_ISSUER,
  jwt_pwd_setup_audience: envVars.JWT_PWD_SETUP_AUDIENCE,
  jwt_pwd_reset_secret: envVars.JWT_PWD_RESET_SECRET,
  jwt_pwd_reset_purpose: envVars.JWT_PWD_RESET_PURPOSE,
  jwt_pwd_reset_issuer: envVars.JWT_PWD_RESET_ISSUER,
  jwt_pwd_reset_audience: envVars.JWT_PWD_RESET_AUDIENCE,
  resend_api_key: envVars.RESEND_API_KEY,
  resend_email: envVars.RESEND_EMAIL,
};
