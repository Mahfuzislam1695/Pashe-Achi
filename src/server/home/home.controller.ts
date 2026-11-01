import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Put, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { AdminHomeBannerDto, AdminHomeCategoryDto, AdminHomeDto, HomeContentDto } from '@/shared'
import { memoryStorage } from 'multer'

import { Actor, type AuditActor } from '../audit/actor'
import { AdminGuard, Can } from '../auth/guards'
import { CreateHomeBannerDto, CreateHomeCategoryDto, HomeOrderDto, HomeSectionsDto, HomeServiceParamDto, IdParamDto, UpdateHomeBannerDto, UpdateHomeCategoryDto } from '../common/dto'
import { MAX_UPLOAD_BYTES } from '../uploads/uploads.service'
import { HomeService } from './home.service'

const picture = () => UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
const FILE_BODY = { schema: { type: 'object' as const, required: ['file'], properties: { file: { type: 'string' as const, format: 'binary' } } } }

/** The customer home page, for the website and the app. No sign-in needed, like the catalog. */
@ApiTags('Home page')
@Controller('home')
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get()
  @ApiOperation({ summary: 'What the customer home page shows: banners, categories, service pictures and sections' })
  content(): Promise<HomeContentDto> {
    return this.home.content()
  }

  @Get('banners/:id/image')
  @Header('Cache-Control', 'public, max-age=86400')
  @ApiOperation({ summary: "A banner's uploaded picture (the URL in imageUrl changes whenever the picture does)" })
  bannerImage(@Param() { id }: IdParamDto): Promise<StreamableFile> {
    return this.home.openImage('banners', id)
  }

  @Get('categories/:id/image')
  @Header('Cache-Control', 'public, max-age=86400')
  @ApiOperation({ summary: "A category's uploaded picture" })
  categoryImage(@Param() { id }: IdParamDto): Promise<StreamableFile> {
    return this.home.openImage('categories', id)
  }

  @Get('services/:service/image')
  @Header('Cache-Control', 'public, max-age=86400')
  @ApiOperation({ summary: "A service tile's uploaded picture" })
  serviceImage(@Param() { service }: HomeServiceParamDto): Promise<StreamableFile> {
    return this.home.openServiceImage(service)
  }
}

@ApiTags('Admin: home page')
@ApiCookieAuth('pa_admin_at')
@UseGuards(AdminGuard)
@Can('home.edit')
@Controller('admin/home')
export class AdminHomeController {
  constructor(private readonly home: HomeService) {}

  @Get()
  @Can('home.view')
  @ApiOperation({ summary: 'The whole home page, hidden rows included' })
  content(): Promise<AdminHomeDto> {
    return this.home.adminContent()
  }

  @Put('sections')
  @ApiOperation({ summary: "Each section's heading and whether it shows" })
  sections(@Actor() actor: AuditActor, @Body() body: HomeSectionsDto): Promise<AdminHomeDto> {
    return this.home.saveSections(body, actor)
  }

  @Post('banners')
  @ApiOperation({ summary: 'Add a banner at the end (upload its picture next with PUT banners/:id/image)' })
  createBanner(@Actor() actor: AuditActor, @Body() body: CreateHomeBannerDto): Promise<AdminHomeBannerDto> {
    return this.home.createBanner(body, actor)
  }

  @Put('banners/order')
  @ApiOperation({ summary: 'Put the banners in this order (every id)' })
  orderBanners(@Actor() actor: AuditActor, @Body() { ids }: HomeOrderDto): Promise<AdminHomeDto> {
    return this.home.reorder('banners', ids, actor)
  }

  @Patch('banners/:id')
  updateBanner(@Actor() actor: AuditActor, @Param() { id }: IdParamDto, @Body() body: UpdateHomeBannerDto): Promise<AdminHomeBannerDto> {
    return this.home.updateBanner(id, body, actor)
  }

  @Delete('banners/:id')
  @HttpCode(204)
  async removeBanner(@Actor() actor: AuditActor, @Param() { id }: IdParamDto) {
    await this.home.remove('banners', id, actor)
  }

  @Put('banners/:id/image')
  @picture()
  @ApiConsumes('multipart/form-data')
  @ApiBody(FILE_BODY)
  @ApiOperation({ summary: 'Add or replace the picture: JPG, PNG or WebP, up to 5 MB' })
  setBannerImage(@Actor() actor: AuditActor, @Param() { id }: IdParamDto, @UploadedFile() file: Express.Multer.File | undefined): Promise<AdminHomeDto> {
    return this.home.setImage('banners', id, file, actor)
  }

  @Delete('banners/:id/image')
  removeBannerImage(@Actor() actor: AuditActor, @Param() { id }: IdParamDto): Promise<AdminHomeDto> {
    return this.home.removeImage('banners', id, actor)
  }

  @Post('categories')
  @ApiOperation({ summary: 'Add a category at the end (upload its picture next with PUT categories/:id/image)' })
  createCategory(@Actor() actor: AuditActor, @Body() body: CreateHomeCategoryDto): Promise<AdminHomeCategoryDto> {
    return this.home.createCategory(body, actor)
  }

  @Put('categories/order')
  @ApiOperation({ summary: 'Put the categories in this order (every id)' })
  orderCategories(@Actor() actor: AuditActor, @Body() { ids }: HomeOrderDto): Promise<AdminHomeDto> {
    return this.home.reorder('categories', ids, actor)
  }

  @Patch('categories/:id')
  updateCategory(@Actor() actor: AuditActor, @Param() { id }: IdParamDto, @Body() body: UpdateHomeCategoryDto): Promise<AdminHomeCategoryDto> {
    return this.home.updateCategory(id, body, actor)
  }

  @Delete('categories/:id')
  @HttpCode(204)
  async removeCategory(@Actor() actor: AuditActor, @Param() { id }: IdParamDto) {
    await this.home.remove('categories', id, actor)
  }

  @Put('categories/:id/image')
  @picture()
  @ApiConsumes('multipart/form-data')
  @ApiBody(FILE_BODY)
  @ApiOperation({ summary: 'Add or replace the picture: JPG, PNG or WebP, up to 5 MB' })
  setCategoryImage(@Actor() actor: AuditActor, @Param() { id }: IdParamDto, @UploadedFile() file: Express.Multer.File | undefined): Promise<AdminHomeDto> {
    return this.home.setImage('categories', id, file, actor)
  }

  @Delete('categories/:id/image')
  removeCategoryImage(@Actor() actor: AuditActor, @Param() { id }: IdParamDto): Promise<AdminHomeDto> {
    return this.home.removeImage('categories', id, actor)
  }

  @Put('services/:service/image')
  @picture()
  @ApiConsumes('multipart/form-data')
  @ApiBody(FILE_BODY)
  @ApiOperation({ summary: "Replace a service tile's picture: JPG, PNG or WebP, up to 5 MB" })
  setServiceImage(@Actor() actor: AuditActor, @Param() { service }: HomeServiceParamDto, @UploadedFile() file: Express.Multer.File | undefined): Promise<AdminHomeDto> {
    return this.home.setServiceImage(service, file, actor)
  }

  @Delete('services/:service/image')
  removeServiceImage(@Actor() actor: AuditActor, @Param() { service }: HomeServiceParamDto): Promise<AdminHomeDto> {
    return this.home.removeServiceImage(service, actor)
  }
}
