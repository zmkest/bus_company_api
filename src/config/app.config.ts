import { INestApplication, ValidationPipe, ValidationPipeOptions } from '@nestjs/common';
import { HttpExceptionFilter } from '../common/exceptions/http-exception.filter.js';

export const configureApp = (app: INestApplication) => {
  app.useGlobalPipes(new ValidationPipe(VALIDATION_OPTIONS));

  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('api');
};

export const VALIDATION_OPTIONS: ValidationPipeOptions = {
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
};
