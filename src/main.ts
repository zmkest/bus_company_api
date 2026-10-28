import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { envs } from './config/envs.js';
import cookieParser from 'cookie-parser';
import { configureApp } from './config/app.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.enableCors({
    methods: ['GET', 'PATCH', 'POST', 'DELETE'],
    origin: envs.frontend_url,
    credentials: true,
  });

  configureApp(app);

  await app.listen(envs.port, () => `Server running on port ${envs.port}`);
}
await bootstrap();
