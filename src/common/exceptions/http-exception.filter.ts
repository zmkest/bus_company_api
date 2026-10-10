
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttp ? exception.getResponse() : null;

    const message = typeof body === 'object' && body !== null && 'message' in body
      ? (body as { message: string | string[] }).message
      : isHttp
      ? exception.message
      : 'Internal server error';
      
    response
      .status(status)
      .json({
        statusCode: status,
        message: message,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
  }
}
