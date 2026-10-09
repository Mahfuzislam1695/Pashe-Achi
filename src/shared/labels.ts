import type { AdminRole, NotificationType, OrderStatus, ServiceId, Text } from './enums'

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
