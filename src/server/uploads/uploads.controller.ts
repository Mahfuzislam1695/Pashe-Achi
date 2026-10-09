import { Controller, Get, Param, Post, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { UploadDto } from '@/shared'
import { memoryStorage } from 'multer'

import type { CustomerPrincipal } from '../auth/auth.types'
import { AdminGuard, CurrentCustomer, CustomerGuard } from '../auth/guards'
import { IdParamDto } from '../common/dto'
import { MAX_UPLOAD_BYTES, UploadsService } from './uploads.service'

@ApiTags('Uploads')
@ApiBearerAuth()
@ApiCookieAuth('pa_at')
@UseGuards(CustomerGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('prescription')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Upload a prescription photo or PDF (max 5 MB). Send the returned id with the medicine order.' })
  upload(@CurrentCustomer() customer: CustomerPrincipal, @UploadedFile() file: Express.Multer.File | undefined): Promise<UploadDto> {
    return this.uploads.savePrescription(customer.id, file)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Download your own uploaded file' })
  download(@CurrentCustomer() customer: CustomerPrincipal, @Param() { id }: IdParamDto): Promise<StreamableFile> {
    return this.uploads.openForCustomer(customer.id, id)
  }
}

@ApiTags('Admin: uploads')
@ApiCookieAuth('pa_admin_at')
@UseGuards(AdminGuard)
@Controller('admin/uploads')
export class AdminUploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Get(':id')
  download(@Param() { id }: IdParamDto): Promise<StreamableFile> {
    return this.uploads.openForAdmin(id)
  }
}
