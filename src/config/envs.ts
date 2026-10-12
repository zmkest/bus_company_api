import 'dotenv/config';
import joi from 'joi';

interface EnvVars {
    PORT: number;
    DATABASE_URL: string;
    JWT_SECRET: string;
    JWT_REFRESH_SECRET: string;
}

const envsSchema = joi
.object({
    PORT: joi.number().default(3000),
    DATABASE_URL: joi.string().required(),
    JWT_SECRET: joi.string().required(),
    JWT_REFRESH_SECRET: joi.string().required()
}).unknown(true);

const { error, value } = envsSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const envVars: EnvVars = value;

export const envs = {
    port: envVars.PORT,
    databaseUrl: envVars.DATABASE_URL,
    jwt_secret: envVars.JWT_SECRET,
    jwt_refresh_token: envVars.JWT_REFRESH_SECRET
};