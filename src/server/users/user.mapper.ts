import type { AdminCustomerDto, AdminDto, CustomerDto } from '@/shared'

import type { Admin, User } from '../generated/prisma/client'

export const toCustomerDto = (user: User): CustomerDto => ({
  id: user.id,
  name: user.name,
  mobile: user.mobile,
  location: user.location,
  points: user.points,
  lang: user.lang,
  createdAt: user.createdAt.toISOString(),
})

export const toAdminCustomerDto = (user: User & { _count: { orders: number }; orders: { createdAt: Date }[] }): AdminCustomerDto => ({
  ...toCustomerDto(user),
  isBlocked: user.isBlocked,
  orderCount: user._count.orders,
  lastOrderAt: user.orders[0]?.createdAt.toISOString() ?? null,
})

export const toAdminDto = (admin: Admin): AdminDto => ({
  id: admin.id,
  name: admin.name,
  mobile: admin.mobile,
  role: admin.role,
  isActive: admin.isActive,
  createdAt: admin.createdAt.toISOString(),
})
