/**
 * Global Exception Filter
 * 
 * Sanitizes error responses to prevent information leakage:
 * - No stack traces in production
 * - No internal error details
 * - Consistent error format
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  statusCode: number;
  message: string;
  error?: string;
  timestamp: string;
  path: string;
  requestId?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = request.headers['x-request-id'] as string;
    
    let status: number;
    let message: string;
    let error: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, any>;
        message = responseObj.message || exception.message;
        error = responseObj.error;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      
      // In production, hide internal error details
      if (process.env.NODE_ENV === 'production') {
        message = 'An internal error occurred';
        error = 'Internal Server Error';
      } else {
        message = exception.message;
        error = exception.name;
      }

      // Always log internal errors
      this.logger.error(
        `Internal error: ${exception.message}`,
        exception.stack,
        { requestId, path: request.path },
      );
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected error occurred';
      
      this.logger.error('Unknown exception type', exception);
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.path,
    };

    if (error) {
      errorResponse.error = error;
    }

    if (requestId) {
      errorResponse.requestId = requestId;
    }

    response.status(status).json(errorResponse);
  }
}
