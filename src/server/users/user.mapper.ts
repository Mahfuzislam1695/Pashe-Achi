import { type AdminCustomerDto, type AdminDto, type CustomerDto, type CustomerLocationInput, toGeoPoint } from '@/shared'

import type { User } from '../generated/prisma/client'
import { type AdminWithRole, permissionsOf, toRoleRef } from '../roles/role.mapper'

/** The customer's location as the User columns hold it (signup and PUT /me/location). */
export const locationColumns = (input: CustomerLocationInput) => ({
  location: input.address,
  locationDetails: input.details ?? '',
  locationLat: input.lat,
  locationLng: input.lng,
})

export const LOCATION_FIELDS = ['location', 'locationDetails', 'locationLat', 'locationLng'] as const

export const toCustomerDto = (user: User): CustomerDto => {
  const pin = toGeoPoint(user.locationLat, user.locationLng)
  return {
    id: user.id,
    name: user.name,
    mobile: user.mobile,
    location: pin && user.location ? { address: user.location, details: user.locationDetails, ...pin } : null,
    points: user.points,
    lang: user.lang,
    createdAt: user.createdAt.toISOString(),
  }
}

export const toAdminCustomerDto = (user: User & { _count: { orders: number }; orders: { createdAt: Date }[] }): AdminCustomerDto => ({
  ...toCustomerDto(user),
  isBlocked: user.isBlocked,
  orderCount: user._count.orders,
  lastOrderAt: user.orders[0]?.createdAt.toISOString() ?? null,
})

export const toAdminDto = (admin: AdminWithRole): AdminDto => ({
  id: admin.id,
  name: admin.name,
  mobile: admin.mobile,
  role: toRoleRef(admin.role),
  permissions: permissionsOf(admin.role),
  isActive: admin.isActive,
  createdAt: admin.createdAt.toISOString(),
})
