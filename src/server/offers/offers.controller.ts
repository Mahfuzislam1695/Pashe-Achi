import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Put, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { AdminOfferDto, OfferDto } from '@/shared'
import { memoryStorage } from 'multer'

import { Actor, type AuditActor } from '../audit/actor'
import { AdminGuard, Roles } from '../auth/guards'
import { CreateOfferDto, IdParamDto, UpdateOfferDto } from '../common/dto'
import { MAX_UPLOAD_BYTES } from '../uploads/uploads.service'
import { OffersService } from './offers.service'

/** আজকের অফার for everyone: the customer app, the public landing page and, later, the mobile app. No sign-in needed. */
@ApiTags('Offers')
@Controller('offers')
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  @ApiOperation({ summary: 'The offers running today (Bangladesh time), newest first' })
  list(): Promise<OfferDto[]> {
    return this.offers.listRunning()
  }

  @Get(':id/image')
  @Header('Cache-Control', 'public, max-age=86400')
  @ApiOperation({ summary: "A running offer's picture (the URL in imageUrl changes whenever the picture does)" })
  image(@Param() { id }: IdParamDto): Promise<StreamableFile> {
    return this.offers.openPublicImage(id)
  }
}

@ApiTags('Admin: offers')
@ApiCookieAuth('pa_admin_at')
@UseGuards(AdminGuard)
@Controller('admin/offers')
export class AdminOffersController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  @ApiOperation({ summary: 'Every offer, running and upcoming first, with its status' })
  list(): Promise<AdminOfferDto[]> {
    return this.offers.listAll()
  }

  @Post()
  @Roles('MANAGER')
  @ApiOperation({ summary: 'Add an offer (upload its picture next with PUT :id/image)' })
  create(@Actor() actor: AuditActor, @Body() body: CreateOfferDto): Promise<AdminOfferDto> {
    return this.offers.create(body, actor)
  }

  @Patch(':id')
  @Roles('MANAGER')
  update(@Actor() actor: AuditActor, @Param() { id }: IdParamDto, @Body() body: UpdateOfferDto): Promise<AdminOfferDto> {
    return this.offers.update(id, body, actor)
  }

  @Delete(':id')
  @Roles('MANAGER')
  @HttpCode(204)
  async remove(@Actor() actor: AuditActor, @Param() { id }: IdParamDto) {
    await this.offers.remove(id, actor)
  }

  @Put(':id/image')
  @Roles('MANAGER')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Add or replace the picture: JPG, PNG or WebP, up to 5 MB' })
  setImage(@Actor() actor: AuditActor, @Param() { id }: IdParamDto, @UploadedFile() file: Express.Multer.File | undefined): Promise<AdminOfferDto> {
    return this.offers.setImage(id, file, actor)
  }

  @Delete(':id/image')
  @Roles('MANAGER')
  removeImage(@Actor() actor: AuditActor, @Param() { id }: IdParamDto): Promise<AdminOfferDto> {
    return this.offers.removeImage(id, actor)
  }

  @Get(':id/image')
  @ApiOperation({ summary: "Any offer's picture (including ones not running)" })
  image(@Param() { id }: IdParamDto): Promise<StreamableFile> {
    return this.offers.openAdminImage(id)
  }

  @Post(':id/notify')
  @Roles('MANAGER')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send the offer to every active customer as a notification' })
  notify(@Actor() actor: AuditActor, @Param() { id }: IdParamDto): Promise<{ sent: number }> {
    return this.offers.announce(id, actor)
  }
}
