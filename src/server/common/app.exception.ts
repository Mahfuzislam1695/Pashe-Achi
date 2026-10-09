import { HttpException, HttpStatus } from '@nestjs/common'
import { type MessageCode, MESSAGES } from '@/shared'

/**
 * Throw this for every expected failure. `code` is a MessageCode from @/shared, so
 * clients can show the Bangla/English text for it.
 */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: MessageCode,
  ) {
    super({ statusCode: status, code, message: MESSAGES[code] }, status)
  }

  static badRequest(code: MessageCode = 'validation') {
    return new AppException(HttpStatus.BAD_REQUEST, code)
  }

  static unauthorized(code: MessageCode = 'auth.required') {
    return new AppException(HttpStatus.UNAUTHORIZED, code)
  }

  static forbidden(code: MessageCode = 'forbidden') {
    return new AppException(HttpStatus.FORBIDDEN, code)
  }

  static notFound(code: MessageCode = 'not_found') {
    return new AppException(HttpStatus.NOT_FOUND, code)
  }

  static conflict(code: MessageCode = 'conflict') {
    return new AppException(HttpStatus.CONFLICT, code)
  }
}
