import {
  type CallHandler,
  Body,
  Controller,
  Delete,
  type ExecutionContext,
  Get,
  Header,
  HttpStatus,
  type NestInterceptor,
  PayloadTooLargeException,
  Put,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { type ApkInfoDto, MAX_APK_BYTES, type SystemStatusDto } from '@/shared'
import { memoryStorage } from 'multer'
import { catchError, type Observable, throwError } from 'rxjs'

import { Actor, type AuditActor } from '../audit/actor'
import { AdminGuard, Can } from '../auth/guards'
import { AppException } from '../common/app.exception'
import { ApkUploadDto } from '../common/dto'
import { ApkService } from './apk.service'
import { BackupService } from './backup.service'

/** An APK over the limit is stopped by multer with a bare 413; say what the limit is. */
class ApkTooLargeInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(catchError(error => throwError(() => (error instanceof PayloadTooLargeException ? new AppException(HttpStatus.PAYLOAD_TOO_LARGE, 'apk.too_large') : error))))
  }
}

/** The Kingfisher app's APK, for anyone (/app-download and the landing page link here). */
@ApiTags('App')
@Controller('app')
export class AppDownloadController {
  constructor(private readonly apk: ApkService) {}

  @Get('apk')
  @Header('Cache-Control', 'no-cache')
  @ApiOperation({ summary: 'Download the Android app (the APK uploaded on the System page, or the bundled one)' })
  download(): Promise<StreamableFile> {
    return this.apk.open()
  }
}

@ApiTags('Admin: system')
@ApiCookieAuth('pa_admin_at')
@UseGuards(AdminGuard)
@Can('system.view')
@Controller('admin/system')
export class AdminSystemController {
  constructor(
    private readonly backups: BackupService,
    private readonly apk: ApkService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'The database (name, size, PostgreSQL and pg_dump versions) and the current APK' })
  async status(): Promise<SystemStatusDto> {
    const [database, apk] = await Promise.all([this.backups.database(), this.apk.current()])
    return { database, apk }
  }

  @Get('backup')
  @Can('system.backup')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Download a full database backup (pg_dump custom format; restore with pg_restore)' })
  backup(@Actor() actor: AuditActor): Promise<StreamableFile> {
    return this.backups.backup(actor)
  }

  @Put('apk')
  @Can('system.apk')
  @UseInterceptors(ApkTooLargeInterceptor, FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_APK_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' }, version: { type: 'string', example: '1.0.3' } } } })
  @ApiOperation({ summary: 'Upload a new APK (up to 150 MB); /app-download serves it at once' })
  upload(@Actor() actor: AuditActor, @UploadedFile() file: Express.Multer.File | undefined, @Body() body: ApkUploadDto): Promise<ApkInfoDto> {
    return this.apk.upload(file, body, actor)
  }

  @Delete('apk')
  @Can('system.apk')
  @ApiOperation({ summary: 'Remove the uploaded APK, going back to the bundled one' })
  remove(@Actor() actor: AuditActor): Promise<ApkInfoDto | null> {
    return this.apk.remove(actor)
  }
}
