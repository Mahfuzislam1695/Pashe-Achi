import {
  apkUploadSchema,
  backupQuerySchema,
  broadcastSchema,
  changePasswordSchema,
  confirmOrderSchema,
  createAdminSchema,
  createBazarOrderSchema,
  createMedicineOrderSchema,
  createParcelOrderSchema,
  createShiftingOrderSchema,
  customerAuthSchema,
  customerLocationSchema,
  dashboardQuerySchema,
  deliveryHoursSchema,
  deviceRemoveSchema,
  deviceTokenSchema,
  idParamSchema,
  auditStatsQuerySchema,
  customerStatsQuerySchema,
  listAdminNotificationsQuerySchema,
  listAuditQuerySchema,
  listCustomersQuerySchema,
  listMyOrdersQuerySchema,
  listNotificationsQuerySchema,
  homeBannerSchema,
  homeCategorySchema,
  homeOrderSchema,
  homeSectionsSchema,
  homeServiceParamSchema,
  listOffersQuerySchema,
  listOrdersQuerySchema,
  listStaffQuerySchema,
  notificationStatsQuerySchema,
  offerStatsQuerySchema,
  orderStatsQuerySchema,
  loginSchema,
  staffLoginSchema,
  offerSchema,
  pricingSchema,
  pushRemoveSchema,
  pushSubscriptionSchema,
  quoteOrderSchema,
  refreshSchema,
  reverseGeocodeQuerySchema,
  roleSchema,
  shiftingQuoteSchema,
  signupSchema,
  supportSettingsSchema,
  updateAdminSchema,
  updateCustomerSchema,
  updateHomeBannerSchema,
  updateHomeCategorySchema,
  updateOfferSchema,
  updateOrderStatusSchema,
  updateRoleSchema,
  updateProfileSchema,
  updateVehicleSchema,
  vehicleSchema,
} from '@/shared'
import { createZodDto } from 'nestjs-zod'

// Request DTOs. The schemas live in @/shared so the web app, admin panel and API
// validate with exactly the same rules; these classes give Nest the types and Swagger docs.

export class IdParamDto extends createZodDto(idParamSchema) {}
export class ApkUploadDto extends createZodDto(apkUploadSchema) {}
export class BackupQueryDto extends createZodDto(backupQuerySchema) {}

export class SignupDto extends createZodDto(signupSchema) {}
export class LoginDto extends createZodDto(loginSchema) {}
export class StaffLoginDto extends createZodDto(staffLoginSchema) {}
export class RefreshDto extends createZodDto(refreshSchema) {}
export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}
export class SetLocationDto extends createZodDto(customerLocationSchema) {}
export class ReverseGeocodeQueryDto extends createZodDto(reverseGeocodeQuerySchema) {}

export class CreateBazarOrderDto extends createZodDto(createBazarOrderSchema) {}
export class CreateShiftingOrderDto extends createZodDto(createShiftingOrderSchema) {}
export class CreateMedicineOrderDto extends createZodDto(createMedicineOrderSchema) {}
export class CreateParcelOrderDto extends createZodDto(createParcelOrderSchema) {}
export class ListMyOrdersQueryDto extends createZodDto(listMyOrdersQuerySchema) {}

export class ListOrdersQueryDto extends createZodDto(listOrdersQuerySchema) {}
export class OrderStatsQueryDto extends createZodDto(orderStatsQuerySchema) {}
export class UpdateOrderStatusDto extends createZodDto(updateOrderStatusSchema) {}
export class QuoteOrderDto extends createZodDto(quoteOrderSchema) {}
export class ShiftingQuoteDto extends createZodDto(shiftingQuoteSchema) {}
export class ConfirmOrderDto extends createZodDto(confirmOrderSchema) {}

export class ListCustomersQueryDto extends createZodDto(listCustomersQuerySchema) {}
export class CustomerStatsQueryDto extends createZodDto(customerStatsQuerySchema) {}
export class UpdateCustomerDto extends createZodDto(updateCustomerSchema) {}

export class PricingDto extends createZodDto(pricingSchema) {}
export class VehicleDto extends createZodDto(vehicleSchema) {}
export class UpdateVehicleDto extends createZodDto(updateVehicleSchema) {}
export class SupportSettingsDto extends createZodDto(supportSettingsSchema) {}
export class CustomerAuthDto extends createZodDto(customerAuthSchema) {}
export class DeliveryHoursDto extends createZodDto(deliveryHoursSchema) {}

export class CreateAdminDto extends createZodDto(createAdminSchema) {}
export class UpdateAdminDto extends createZodDto(updateAdminSchema) {}
export class CreateRoleDto extends createZodDto(roleSchema) {}
export class UpdateRoleDto extends createZodDto(updateRoleSchema) {}
export class ListStaffQueryDto extends createZodDto(listStaffQuerySchema) {}

export class BroadcastDto extends createZodDto(broadcastSchema) {}
export class CreateHomeBannerDto extends createZodDto(homeBannerSchema) {}
export class UpdateHomeBannerDto extends createZodDto(updateHomeBannerSchema) {}
export class CreateHomeCategoryDto extends createZodDto(homeCategorySchema) {}
export class UpdateHomeCategoryDto extends createZodDto(updateHomeCategorySchema) {}
export class HomeOrderDto extends createZodDto(homeOrderSchema) {}
export class HomeSectionsDto extends createZodDto(homeSectionsSchema) {}
export class HomeServiceParamDto extends createZodDto(homeServiceParamSchema) {}
export class CreateOfferDto extends createZodDto(offerSchema) {}
export class UpdateOfferDto extends createZodDto(updateOfferSchema) {}
export class ListOffersQueryDto extends createZodDto(listOffersQuerySchema) {}
export class OfferStatsQueryDto extends createZodDto(offerStatsQuerySchema) {}
export class ListNotificationsQueryDto extends createZodDto(listNotificationsQuerySchema) {}
export class ListAdminNotificationsQueryDto extends createZodDto(listAdminNotificationsQuerySchema) {}
export class NotificationStatsQueryDto extends createZodDto(notificationStatsQuerySchema) {}
export class PushSubscriptionDto extends createZodDto(pushSubscriptionSchema) {}
export class PushRemoveDto extends createZodDto(pushRemoveSchema) {}
export class DeviceTokenDto extends createZodDto(deviceTokenSchema) {}
export class DeviceRemoveDto extends createZodDto(deviceRemoveSchema) {}
export class DashboardQueryDto extends createZodDto(dashboardQuerySchema) {}
export class ListAuditQueryDto extends createZodDto(listAuditQuerySchema) {}
export class AuditStatsQueryDto extends createZodDto(auditStatsQuerySchema) {}
