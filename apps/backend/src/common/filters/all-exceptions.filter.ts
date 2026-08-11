import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError, DomainErrorCode } from '../errors/domain.error';
import { InvalidPhoneNumberError } from '../crypto/phone.util';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
  timestamp: string;
  path: string;
}

/**
 * The single place where an error becomes an HTTP response.
 *
 * Nothing internal crosses this boundary: no stack traces, no Prisma messages,
 * no SQL. Unexpected errors are logged in full server-side and reduced to a
 * generic 500 for the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = request.header('x-request-id') ?? undefined;

    const body = this.toErrorBody(exception, request.url, requestId);

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        { requestId, path: request.url, method: request.method },
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn({
        requestId,
        path: request.url,
        method: request.method,
        code: body.code,
        status: body.statusCode,
      });
    }

    response.status(body.statusCode).json(body);
  }

  private toErrorBody(exception: unknown, path: string, requestId?: string): ErrorBody {
    const timestamp = new Date().toISOString();

    if (exception instanceof DomainError) {
      return {
        statusCode: exception.httpStatus,
        code: exception.code,
        message: exception.message,
        details: exception.details,
        requestId,
        timestamp,
        path,
      };
    }

    if (exception instanceof InvalidPhoneNumberError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: DomainErrorCode.VALIDATION_FAILED,
        message: 'Enter a valid 10-digit Indian mobile number',
        requestId,
        timestamp,
        path,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : ((payload as { message?: string | string[] }).message ?? exception.message);

      return {
        statusCode: status,
        code:
          status === HttpStatus.BAD_REQUEST
            ? DomainErrorCode.VALIDATION_FAILED
            : HttpStatus[status] || 'ERROR',
        message: Array.isArray(message) ? message.join('; ') : message,
        requestId,
        timestamp,
        path,
      };
    }

    // Anything unrecognised is a bug. Say nothing useful to the caller.
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
      requestId,
      timestamp,
      path,
    };
  }
}
