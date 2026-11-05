import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { Request, Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const { message, status } = this.mapError(exception);

    const context = `${req.method} ${req.url} → ${status} [${exception.code}]`;

    if (status >= 500) {
      this.logger.error(context, exception.stack);
    } else {
      this.logger.warn(`${context} → ${status}`);
    }

    res.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }

  private mapError(e: Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case 'P2025':
        return { status: HttpStatus.NOT_FOUND, message: 'Recurso no encontrado' };
      case 'P2002':
        return { status: HttpStatus.CONFLICT, message: 'El registro ya existe' };
      case 'P2003':
        return {
          status: HttpStatus.CONFLICT,
          message: 'Referencia a un registro inválido o en uso',
        };
      default:
        return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Error interno del servidor' };
    }
  }
}
