import {
  broadcastSchema,
  changePasswordSchema,
  createAdminSchema,
  createBazarOrderSchema,
  createMedicineOrderSchema,
  createParcelOrderSchema,
  createShiftingOrderSchema,
  dashboardQuerySchema,
  idParamSchema,
  listAuditQuerySchema,
  listCustomersQuerySchema,
  listMyOrdersQuerySchema,
  listNotificationsQuerySchema,
  listOrdersQuerySchema,
  loginSchema,
  pricingSchema,
  refreshSchema,
  signupSchema,
  supportSettingsSchema,
  updateAdminSchema,
  updateCustomerSchema,
  updateOrderItemsSchema,
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

export class CreateBazarOrderDto extends createZodDto(createBazarOrderSchema) {}
export class CreateShiftingOrderDto extends createZodDto(createShiftingOrderSchema) {}
export class CreateMedicineOrderDto extends createZodDto(createMedicineOrderSchema) {}
export class CreateParcelOrderDto extends createZodDto(createParcelOrderSchema) {}
export class ListMyOrdersQueryDto extends createZodDto(listMyOrdersQuerySchema) {}

export class ListOrdersQueryDto extends createZodDto(listOrdersQuerySchema) {}
export class UpdateOrderStatusDto extends createZodDto(updateOrderStatusSchema) {}
export class UpdateOrderItemsDto extends createZodDto(updateOrderItemsSchema) {}

export class ListCustomersQueryDto extends createZodDto(listCustomersQuerySchema) {}
export class UpdateCustomerDto extends createZodDto(updateCustomerSchema) {}

export class PricingDto extends createZodDto(pricingSchema) {}
export class VehicleDto extends createZodDto(vehicleSchema) {}
export class UpdateVehicleDto extends createZodDto(updateVehicleSchema) {}
export class SupportSettingsDto extends createZodDto(supportSettingsSchema) {}

export class CreateAdminDto extends createZodDto(createAdminSchema) {}
export class UpdateAdminDto extends createZodDto(updateAdminSchema) {}

export class BroadcastDto extends createZodDto(broadcastSchema) {}
export class ListNotificationsQueryDto extends createZodDto(listNotificationsQuerySchema) {}
export class DashboardQueryDto extends createZodDto(dashboardQuerySchema) {}
export class ListAuditQueryDto extends createZodDto(listAuditQuerySchema) {}
