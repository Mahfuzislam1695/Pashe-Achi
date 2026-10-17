import {
  broadcastSchema,
  changePasswordSchema,
  confirmOrderSchema,
  createAdminSchema,
  createBazarOrderSchema,
  createMedicineOrderSchema,
  createParcelOrderSchema,
  createShiftingOrderSchema,
  customerLocationSchema,
  dashboardQuerySchema,
  deliveryHoursSchema,
  idParamSchema,
  listAuditQuerySchema,
  listCustomersQuerySchema,
  listMyOrdersQuerySchema,
  listNotificationsQuerySchema,
  listOrdersQuerySchema,
  loginSchema,
  offerSchema,
  pricingSchema,
  pushRemoveSchema,
  pushSubscriptionSchema,
  quoteOrderSchema,
  refreshSchema,
  reverseGeocodeQuerySchema,
  signupSchema,
  supportSettingsSchema,
  updateAdminSchema,
  updateCustomerSchema,
  updateOfferSchema,
  updateOrderStatusSchema,
  updateProfileSchema,
  updateVehicleSchema,
  vehicleSchema,
} from '@/shared'
import { createZodDto } from 'nestjs-zod'

// Request DTOs. The schemas live in @/shared so the web app, admin panel and API
// validate with exactly the same rules; these classes give Nest the types and Swagger docs.

export class IdParamDto extends createZodDto(idParamSchema) {}

export class SignupDto extends createZodDto(signupSchema) {}
export class LoginDto extends createZodDto(loginSchema) {}
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
export class UpdateOrderStatusDto extends createZodDto(updateOrderStatusSchema) {}
export class QuoteOrderDto extends createZodDto(quoteOrderSchema) {}
export class ConfirmOrderDto extends createZodDto(confirmOrderSchema) {}

export class ListCustomersQueryDto extends createZodDto(listCustomersQuerySchema) {}
export class UpdateCustomerDto extends createZodDto(updateCustomerSchema) {}

export class PricingDto extends createZodDto(pricingSchema) {}
export class VehicleDto extends createZodDto(vehicleSchema) {}
export class UpdateVehicleDto extends createZodDto(updateVehicleSchema) {}
export class SupportSettingsDto extends createZodDto(supportSettingsSchema) {}
export class DeliveryHoursDto extends createZodDto(deliveryHoursSchema) {}

export class CreateAdminDto extends createZodDto(createAdminSchema) {}
export class UpdateAdminDto extends createZodDto(updateAdminSchema) {}

export class BroadcastDto extends createZodDto(broadcastSchema) {}
export class CreateOfferDto extends createZodDto(offerSchema) {}
export class UpdateOfferDto extends createZodDto(updateOfferSchema) {}
export class ListNotificationsQueryDto extends createZodDto(listNotificationsQuerySchema) {}
export class PushSubscriptionDto extends createZodDto(pushSubscriptionSchema) {}
export class PushRemoveDto extends createZodDto(pushRemoveSchema) {}
export class DashboardQueryDto extends createZodDto(dashboardQuerySchema) {}
export class ListAuditQueryDto extends createZodDto(listAuditQuerySchema) {}
