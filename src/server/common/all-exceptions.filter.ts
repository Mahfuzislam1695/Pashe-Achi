import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common'
import { ThrottlerException } from '@nestjs/throttler'
import { type ApiErrorBody, isMessageCode, type MessageCode, MESSAGES } from '@/shared'
import type { Response } from 'express'
import { ZodValidationException } from 'nestjs-zod'
import type { ZodError } from 'zod'

import { Prisma } from '../generated/prisma/client'
import { AppException } from './app.exception'

const STATUS_CODES: Partial<Record<number, MessageCode>> = {
  400: 'validation',
  401: 'auth.required',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  413: 'upload.size',
  429: 'rate_limited',
}

/**
 * Turns every error into the same JSON shape: { statusCode, code, message: { bn, en }, issues? }.
 * Unknown errors become a 500 with no internal details, and are logged.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions')

  catch(exception: unknown, host: ArgumentsHost) {
    // WebSocket errors are handled by the gateway itself.
    if (host.getType() !== 'http') return

    const response = host.switchToHttp().getResponse<Response>()
    const body = this.toBody(exception)
    if (body.statusCode >= 500) this.logger.error(exception instanceof Error ? exception.stack : exception)
    if (!response.headersSent) response.status(body.statusCode).json(body)
  }

  private toBody(exception: unknown): ApiErrorBody {
    if (exception instanceof ZodValidationException) {
      const error = exception.getZodError() as ZodError
      const issues = error.issues.map(issue => ({ path: issue.path.map(part => (typeof part === 'symbol' ? String(part) : part)), code: issue.message }))
      const code = issues.map(issue => issue.code).find(isMessageCode) ?? 'validation'
      return { statusCode: 400, code, message: MESSAGES[code], issues }
    }

    if (exception instanceof AppException) {
      return { statusCode: exception.getStatus(), code: exception.code, message: MESSAGES[exception.code] }
    }

    if (exception instanceof ThrottlerException) return this.body(HttpStatus.TOO_MANY_REQUESTS, 'rate_limited')

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      return this.body(status, STATUS_CODES[status] ?? (status >= 500 ? 'server' : 'validation'))
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        const target = JSON.stringify(exception.meta ?? {})
        return this.body(HttpStatus.CONFLICT, target.includes('mobile') ? 'mobile.taken' : 'conflict')
      }
      if (exception.code === 'P2025') return this.body(HttpStatus.NOT_FOUND, 'not_found')
    }

    return this.body(HttpStatus.INTERNAL_SERVER_ERROR, 'server')
  }

  private body(statusCode: number, code: MessageCode): ApiErrorBody {
    return { statusCode, code, message: MESSAGES[code] }
  }
}
