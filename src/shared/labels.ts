import type { ActorType, AdminRole, AuditAction, AuditEntity, NotificationType, OrderStatus, ServiceId, Text } from './enums'

export const SERVICE_LABELS: Record<ServiceId, Text> = {
  bazar: { bn: 'কাঁচা বাজার', en: 'Fresh market' },
  shifting: { bn: 'বাসা বদল', en: 'House shifting' },
  medicine: { bn: 'জরুরী ঔষুধ', en: 'Emergency medicine' },
  parcel: { bn: 'পণ্য আদান প্রদান', en: 'Parcel delivery' },
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, Text> = {
  PENDING: { bn: 'অপেক্ষমাণ', en: 'Pending' },
  BOOKED: { bn: 'বুক করা হয়েছে', en: 'Booked' },
  IN_PROGRESS: { bn: 'চলমান', en: 'In progress' },
  COMPLETED: { bn: 'সম্পন্ন', en: 'Completed' },
  CANCELLED: { bn: 'বাতিল', en: 'Cancelled' },
}

export const ADMIN_ROLE_LABELS: Record<AdminRole, Text> = {
  SUPER_ADMIN: { bn: 'সুপার অ্যাডমিন', en: 'Super admin' },
  MANAGER: { bn: 'ম্যানেজার', en: 'Manager' },
  OPERATOR: { bn: 'অপারেটর', en: 'Operator' },
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, Text> = {
  ORDER_CREATED: { bn: 'নতুন অর্ডার', en: 'New order' },
  ORDER_STATUS: { bn: 'অর্ডারের অবস্থা', en: 'Order status' },
  ORDER_BILL: { bn: 'বিল আপডেট', en: 'Bill update' },
  ANNOUNCEMENT: { bn: 'ঘোষণা', en: 'Announcement' },
}

export const ACTOR_TYPE_LABELS: Record<ActorType, Text> = {
  CUSTOMER: { bn: 'গ্রাহক', en: 'Customer' },
  ADMIN: { bn: 'স্টাফ', en: 'Staff' },
  SYSTEM: { bn: 'সিস্টেম', en: 'System' },
}

export const AUDIT_ENTITY_LABELS: Record<AuditEntity, Text> = {
  ORDER: { bn: 'অর্ডার', en: 'Orders' },
  CUSTOMER: { bn: 'গ্রাহক', en: 'Customers' },
  STAFF: { bn: 'স্টাফ', en: 'Staff' },
  PRICING: { bn: 'দাম', en: 'Pricing' },
  VEHICLE: { bn: 'গাড়ী', en: 'Vehicles' },
  SUPPORT: { bn: 'সাপোর্ট লাইন', en: 'Support line' },
  ANNOUNCEMENT: { bn: 'ঘোষণা', en: 'Announcements' },
}

export const AUDIT_ACTION_LABELS: Record<AuditAction, Text> = {
  CUSTOMER_SIGNED_UP: { bn: 'সাইন আপ', en: 'Signed up' },
  CUSTOMER_PROFILE_UPDATED: { bn: 'প্রোফাইল আপডেট', en: 'Profile updated' },
  CUSTOMER_PASSWORD_CHANGED: { bn: 'পাসওয়ার্ড বদল', en: 'Password changed' },
  CUSTOMER_BLOCKED: { bn: 'গ্রাহক বন্ধ', en: 'Customer blocked' },
  CUSTOMER_UNBLOCKED: { bn: 'গ্রাহক চালু', en: 'Customer unblocked' },
  CUSTOMER_POINTS_CHANGED: { bn: 'পয়েন্ট বদল', en: 'Points changed' },
  ORDER_CREATED: { bn: 'নতুন অর্ডার', en: 'Order placed' },
  ORDER_STATUS_CHANGED: { bn: 'অবস্থা বদল', en: 'Status changed' },
  ORDER_BILL_UPDATED: { bn: 'বিল সংশোধন', en: 'Bill corrected' },
  PRICING_UPDATED: { bn: 'দাম আপডেট', en: 'Pricing updated' },
  VEHICLE_CREATED: { bn: 'নতুন গাড়ী', en: 'Vehicle added' },
  VEHICLE_UPDATED: { bn: 'গাড়ী আপডেট', en: 'Vehicle updated' },
  SUPPORT_UPDATED: { bn: 'সাপোর্ট লাইন আপডেট', en: 'Support line updated' },
  STAFF_CREATED: { bn: 'নতুন স্টাফ', en: 'Staff added' },
  STAFF_UPDATED: { bn: 'স্টাফ আপডেট', en: 'Staff updated' },
  STAFF_PASSWORD_RESET: { bn: 'স্টাফের পাসওয়ার্ড রিসেট', en: 'Staff password reset' },
  ADMIN_SIGNED_IN: { bn: 'সাইন ইন', en: 'Signed in' },
  ADMIN_SIGN_IN_FAILED: { bn: 'সাইন ইন ব্যর্থ', en: 'Sign-in failed' },
  ADMIN_SIGNED_OUT: { bn: 'সাইন আউট', en: 'Signed out' },
  ADMIN_PASSWORD_CHANGED: { bn: 'নিজের পাসওয়ার্ড বদল', en: 'Own password changed' },
  ANNOUNCEMENT_SENT: { bn: 'ঘোষণা পাঠানো', en: 'Announcement sent' },
}

/** Names of the fields a history entry can show as "before → after". Pricing names match the Catalog page. */
export const AUDIT_FIELD_LABELS: Record<string, Text> = {
  bazarShoppingFee: { bn: 'বাজার ক্রয় বাবদ মজুরী', en: 'Bazar shopping fee' },
  bazarDeliveryFee: { bn: 'বাজার ডেলিভারী খরচ', en: 'Bazar delivery charge' },
  medicineDeliveryFee: { bn: 'ঔষুধ ডেলিভারী চার্জ', en: 'Medicine delivery charge' },
  parcelDeliveryFee: { bn: 'পার্সেল ডেলিভারী খরচ', en: 'Parcel delivery charge' },
  wagePerLabourer: { bn: 'লেবার জনপ্রতি মজুরী', en: 'Wage per labourer' },
  loadingRatePerFloor: { bn: 'প্রতি ফ্লোর (loading)', en: 'Per floor (loading)' },
  unloadingRatePerFloor: { bn: 'প্রতি ফ্লোর (unloading)', en: 'Per floor (unloading)' },
  nameBn: { bn: 'বাংলা নাম', en: 'Name (Bangla)' },
  nameEn: { bn: 'ইংরেজি নাম', en: 'Name (English)' },
  rate: { bn: 'রেট', en: 'Rate' },
  sortOrder: { bn: 'ক্রম', en: 'Order' },
  isActive: { bn: 'চালু', en: 'Active' },
  phone: { bn: 'কল নম্বর', en: 'Call number' },
  whatsapp: { bn: 'WhatsApp লিংক', en: 'WhatsApp link' },
  name: { bn: 'নাম', en: 'Name' },
  mobile: { bn: 'মোবাইল', en: 'Mobile' },
  location: { bn: 'এলাকা', en: 'Location' },
  lang: { bn: 'ভাষা', en: 'Language' },
  isBlocked: { bn: 'বন্ধ', en: 'Blocked' },
  points: { bn: 'পয়েন্ট', en: 'Points' },
  role: { bn: 'রোল', en: 'Role' },
  status: { bn: 'অবস্থা', en: 'Status' },
  'item.price': { bn: 'দাম', en: 'Price' },
  total: { bn: 'মোট বিল', en: 'Total' },
}
