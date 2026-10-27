import type { ActorType, AuditAction, AuditEntity, NotificationType, OrderStatus, ServiceId, Text } from './enums'
import type { Permission, PermissionModule } from './permissions'

export const SERVICE_LABELS: Record<ServiceId, Text> = {
  bazar: { bn: 'কাঁচা বাজার', en: 'Fresh market' },
  shifting: { bn: 'বাসা বদল', en: 'House shifting' },
  medicine: { bn: 'জরুরী ঔষুধ', en: 'Emergency medicine' },
  parcel: { bn: 'পণ্য আদান প্রদান', en: 'Parcel delivery' },
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, Text> = {
  PENDING: { bn: 'অপেক্ষমাণ', en: 'Pending' },
  QUOTED: { bn: 'দাম জানানো হয়েছে', en: 'Price sent' },
  BOOKED: { bn: 'বুক করা হয়েছে', en: 'Booked' },
  IN_PROGRESS: { bn: 'চলমান', en: 'In progress' },
  COMPLETED: { bn: 'সম্পন্ন', en: 'Completed' },
  CANCELLED: { bn: 'বাতিল', en: 'Cancelled' },
}

/**
 * The three roles staff had before roles became editable, by the value history entries from then
 * stored (a STAFF_* entry's role field). The roles migration created a role with each of these names.
 */
export const LEGACY_ROLE_NAMES: Record<string, Text> = {
  SUPER_ADMIN: { bn: 'সুপার অ্যাডমিন', en: 'Super admin' },
  MANAGER: { bn: 'ম্যানেজার', en: 'Manager' },
  OPERATOR: { bn: 'অপারেটর', en: 'Operator' },
}

export const PERMISSION_MODULE_LABELS: Record<PermissionModule, Text> = {
  dashboard: { bn: 'ড্যাশবোর্ড', en: 'Dashboard' },
  orders: { bn: 'অর্ডার', en: 'Orders' },
  customers: { bn: 'গ্রাহক', en: 'Customers' },
  catalog: { bn: 'ক্যাটালগ', en: 'Catalog' },
  offers: { bn: 'আজকের অফার', en: "Today's offers" },
  notifications: { bn: 'নোটিফিকেশন', en: 'Notifications' },
  history: { bn: 'ইতিহাস', en: 'History' },
  staff: { bn: 'স্টাফ', en: 'Staff' },
  roles: { bn: 'রোল ও অনুমতি', en: 'Roles & permissions' },
}

/** Each permission's checkbox label and a line on what it allows. */
export const PERMISSION_LABELS: Record<Permission, { label: Text; hint: Text }> = {
  'dashboard.view': { label: { bn: 'দেখা', en: 'View' }, hint: { bn: 'সংখ্যা, চার্ট ও সাম্প্রতিক অর্ডার', en: 'Numbers, charts and recent orders' } },
  'dashboard.staff_activity': { label: { bn: 'স্টাফের কাজ', en: 'Staff activity' }, hint: { bn: 'কোন স্টাফ কতগুলো অর্ডারে কাজ করেছেন', en: 'How much each staff member did to orders' } },
  'orders.view': { label: { bn: 'দেখা', en: 'View' }, hint: { bn: 'অর্ডারের তালিকা, বিবরণ, প্রেসক্রিপশন ও ইতিহাস', en: 'Order list, details, prescriptions and history' } },
  'orders.update_status': { label: { bn: 'অবস্থা বদল', en: 'Change status' }, hint: { bn: 'বুক, চলমান, সম্পন্ন বা বাতিল করা', en: 'Book, start, complete or cancel orders' } },
  'orders.send_price': { label: { bn: 'দাম পাঠানো', en: 'Send price' }, hint: { bn: 'বাজার, ঔষুধ ও বাসা বদলের দাম দেওয়া', en: 'Price bazar, medicine and shifting orders' } },
  'customers.view': { label: { bn: 'দেখা', en: 'View' }, hint: { bn: 'গ্রাহকের তালিকা ও বিবরণ', en: 'Customer list and details' } },
  'customers.block': { label: { bn: 'বন্ধ/চালু', en: 'Block' }, hint: { bn: 'গ্রাহককে বন্ধ বা আবার চালু করা', en: 'Block or unblock a customer' } },
  'customers.edit_points': { label: { bn: 'পয়েন্ট বদল', en: 'Edit points' }, hint: { bn: 'গ্রাহকের পয়েন্ট সেট করা', en: "Set a customer's reward points" } },
  'catalog.view': { label: { bn: 'দেখা', en: 'View' }, hint: { bn: 'দাম, গাড়ী, সাপোর্ট লাইন ও ডেলিভারির সময়', en: 'Pricing, vehicles, support line and delivery hours' } },
  'catalog.edit': { label: { bn: 'এডিট', en: 'Edit' }, hint: { bn: 'দাম, গাড়ী, সাপোর্ট লাইন ও ডেলিভারির সময় বদলানো', en: 'Change pricing, vehicles, support line and delivery hours' } },
  'catalog.customer_signin': { label: { bn: 'গ্রাহকের লগইন', en: 'Customer sign-in' }, hint: { bn: 'গ্রাহকের পাসওয়ার্ড লাগবে কিনা', en: 'Whether customers need a password' } },
  'offers.view': { label: { bn: 'দেখা', en: 'View' }, hint: { bn: 'সব অফার', en: 'Every offer' } },
  'offers.create': { label: { bn: 'নতুন', en: 'Create' }, hint: { bn: 'নতুন অফার দেওয়া', en: 'Post a new offer' } },
  'offers.edit': { label: { bn: 'এডিট', en: 'Edit' }, hint: { bn: 'অফার ও ছবি বদলানো', en: 'Change an offer and its picture' } },
  'offers.delete': { label: { bn: 'মুছে ফেলা', en: 'Delete' }, hint: { bn: 'অফার মুছে ফেলা', en: 'Delete an offer' } },
  'offers.notify': { label: { bn: 'গ্রাহকদের জানানো', en: 'Notify customers' }, hint: { bn: 'সব গ্রাহককে অফারের নোটিফিকেশন পাঠানো', en: 'Send an offer to every customer' } },
  'notifications.view': { label: { bn: 'দেখা', en: 'View' }, hint: { bn: 'নিজের ইনবক্স ও নতুন অর্ডারের খবর', en: 'Own inbox and new order alerts' } },
  'notifications.broadcast': { label: { bn: 'ঘোষণা পাঠানো', en: 'Broadcast' }, hint: { bn: 'সব গ্রাহকের কাছে ঘোষণা', en: 'Announcements to every customer' } },
  'history.view': { label: { bn: 'দেখা', en: 'View' }, hint: { bn: 'কে, কখন, কী বদলেছেন: পুরো ইতিহাস', en: 'The full log of who changed what' } },
  'staff.view': { label: { bn: 'দেখা', en: 'View' }, hint: { bn: 'স্টাফের তালিকা', en: 'Staff list' } },
  'staff.create': { label: { bn: 'নতুন', en: 'Create' }, hint: { bn: 'নতুন স্টাফ যোগ করা', en: 'Add staff' } },
  'staff.edit': { label: { bn: 'এডিট', en: 'Edit' }, hint: { bn: 'রোল বদল, চালু বা বন্ধ করা', en: 'Change role, enable or disable' } },
  'staff.reset_password': { label: { bn: 'পাসওয়ার্ড রিসেট', en: 'Reset password' }, hint: { bn: 'স্টাফের নতুন পাসওয়ার্ড দেওয়া', en: "Set a staff member's new password" } },
  'roles.view': { label: { bn: 'দেখা', en: 'View' }, hint: { bn: 'রোলগুলো আর কোনটায় কী করা যায়', en: 'See the roles and what each allows' } },
  'roles.create': { label: { bn: 'নতুন', en: 'Create' }, hint: { bn: 'নতুন রোল বানানো, শুধু নিজের অনুমতিগুলো দিয়ে', en: 'Make roles, with permissions you hold yourself' } },
  'roles.edit': { label: { bn: 'এডিট', en: 'Edit' }, hint: { bn: 'অন্য রোল বদলানো, শুধু নিজের অনুমতিগুলো', en: 'Change other roles, only permissions you hold yourself' } },
  'roles.delete': { label: { bn: 'মুছে ফেলা', en: 'Delete' }, hint: { bn: 'যে রোলে কোনো স্টাফ নেই তা মুছে ফেলা', en: 'Delete roles no staff member holds' } },
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, Text> = {
  ORDER_CREATED: { bn: 'নতুন অর্ডার', en: 'New order' },
  ORDER_STATUS: { bn: 'অর্ডারের অবস্থা', en: 'Order status' },
  ORDER_BILL: { bn: 'বিল আপডেট', en: 'Bill update' },
  ANNOUNCEMENT: { bn: 'ঘোষণা', en: 'Announcement' },
  OFFER: { bn: 'আজকের অফার', en: "Today's offer" },
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
  DELIVERY_HOURS: { bn: 'ডেলিভারির সময় সূচী', en: 'Delivery hours' },
  OFFER: { bn: 'অফার', en: 'Offers' },
  CUSTOMER_AUTH: { bn: 'গ্রাহকের লগইন', en: 'Customer sign-in' },
  ROLE: { bn: 'রোল', en: 'Roles' },
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
  DELIVERY_HOURS_UPDATED: { bn: 'ডেলিভারির সময় আপডেট', en: 'Delivery hours updated' },
  // ADDED and DELETED are from the time of saved places; kept for the history they wrote.
  CUSTOMER_LOCATION_ADDED: { bn: 'লোকেশন সেভ', en: 'Location saved' },
  CUSTOMER_LOCATION_UPDATED: { bn: 'লোকেশন আপডেট', en: 'Location updated' },
  CUSTOMER_LOCATION_DELETED: { bn: 'লোকেশন মুছে ফেলা', en: 'Location deleted' },
  OFFER_CREATED: { bn: 'নতুন অফার', en: 'Offer added' },
  OFFER_UPDATED: { bn: 'অফার আপডেট', en: 'Offer updated' },
  OFFER_DELETED: { bn: 'অফার মুছে ফেলা', en: 'Offer deleted' },
  OFFER_ANNOUNCED: { bn: 'অফারের নোটিফিকেশন', en: 'Offer announced' },
  CUSTOMER_AUTH_UPDATED: { bn: 'গ্রাহকের লগইন বদল', en: 'Customer sign-in changed' },
  ROLE_CREATED: { bn: 'নতুন রোল', en: 'Role added' },
  ROLE_UPDATED: { bn: 'রোল আপডেট', en: 'Role updated' },
  ROLE_DELETED: { bn: 'রোল মুছে ফেলা', en: 'Role deleted' },
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
  password: { bn: 'গ্রাহকের পাসওয়ার্ড', en: 'Customer password' },
  bazarHours: { bn: 'কাঁচা বাজারের সময়', en: 'Fresh market hours' },
  shiftingHours: { bn: 'বাসা বদলের সময়', en: 'House shifting hours' },
  medicineHours: { bn: 'জরুরী ঔষুধের সময়', en: 'Emergency medicine hours' },
  parcelHours: { bn: 'পণ্য আদান প্রদানের সময়', en: 'Parcel delivery hours' },
  name: { bn: 'নাম', en: 'Name' },
  mobile: { bn: 'মোবাইল', en: 'Mobile' },
  location: { bn: 'লোকেশন', en: 'Location' },
  locationDetails: { bn: 'বাসা/ফ্ল্যাট, রোড', en: 'House, flat, road' },
  locationLat: { bn: 'অক্ষাংশ', en: 'Latitude' },
  locationLng: { bn: 'দ্রাঘিমাংশ', en: 'Longitude' },
  label: { bn: 'লোকেশনের নাম', en: 'Location name' },
  address: { bn: 'ঠিকানা', en: 'Address' },
  lat: { bn: 'অক্ষাংশ', en: 'Latitude' },
  lng: { bn: 'দ্রাঘিমাংশ', en: 'Longitude' },
  isDefault: { bn: 'ডিফল্ট', en: 'Default' },
  lang: { bn: 'ভাষা', en: 'Language' },
  isBlocked: { bn: 'বন্ধ', en: 'Blocked' },
  points: { bn: 'পয়েন্ট', en: 'Points' },
  role: { bn: 'রোল', en: 'Role' },
  permissions: { bn: 'অনুমতি', en: 'Permissions' },
  'permission.added': { bn: 'অনুমতি দেওয়া', en: 'Permission given' },
  'permission.removed': { bn: 'অনুমতি সরানো', en: 'Permission taken away' },
  descriptionBn: { bn: 'বিবরণ (বাংলা)', en: 'Description (Bangla)' },
  descriptionEn: { bn: 'বিবরণ (ইংরেজি)', en: 'Description (English)' },
  status: { bn: 'অবস্থা', en: 'Status' },
  'item.price': { bn: 'দাম', en: 'Price' },
  'item.added': { bn: 'নতুন লাইন', en: 'Line added' },
  'item.removed': { bn: 'লাইন বাদ', en: 'Line removed' },
  serviceFee: { bn: 'বাজার ক্রয় বাবদ মজুরী', en: 'Shopping fee' },
  vehicleRate: { bn: 'গাড়ী ভাড়া', en: 'Vehicle rent' },
  deliveryFee: { bn: 'ডেলিভারী খরচ', en: 'Delivery charge' },
  titleBn: { bn: 'শিরোনাম (বাংলা)', en: 'Title (Bangla)' },
  titleEn: { bn: 'শিরোনাম (ইংরেজি)', en: 'Title (English)' },
  bodyBn: { bn: 'বিবরণ (বাংলা)', en: 'Details (Bangla)' },
  bodyEn: { bn: 'বিবরণ (ইংরেজি)', en: 'Details (English)' },
  service: { bn: 'সেবা', en: 'Service' },
  startsOn: { bn: 'শুরু', en: 'Starts' },
  endsOn: { bn: 'শেষ', en: 'Ends' },
  image: { bn: 'ছবি', en: 'Picture' },
  total: { bn: 'মোট বিল', en: 'Total' },
}
