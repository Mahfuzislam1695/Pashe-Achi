import type { Text } from './enums'

/**
 * Every user-facing error, keyed by a stable code. Zod schemas use these codes as their
 * messages, the API returns them as `code`, and both front ends show `MESSAGES[code]`.
 * The service-form texts are the exact wording of the paper-sketch screens.
 */
export const MESSAGES = {
  'schedule.required': { bn: 'ডেলিভারি তারিখ ও টাইম দিন।', en: 'Choose the delivery date and time.' },
  'schedule.past': { bn: 'আজ বা পরের কোনো তারিখ দিন।', en: 'Choose today or a later date.' },
  'bazar.rows': { bn: 'প্রতিটি লাইনে বাজারের নাম ও পরিমাণ লিখুন।', en: 'Fill in the item and quantity in each row.' },
  'bazar.details': { bn: 'ঠিকানা, মোবাইল নম্বর ও অন্তত একটি বাজারের লাইন দিন।', en: 'Add your address, mobile number and at least one item.' },
  'shifting.areas': { bn: 'Loading Area ও Unloading Area দিন।', en: 'Add the loading and unloading areas.' },
  'shifting.vehicle': { bn: 'একটি গাড়ী বেছে নিন।', en: 'Choose a vehicle.' },
  'shifting.schedule_required': { bn: 'শিফটিং এর তারিখ ও সময় দিন।', en: 'Choose the shifting date and time.' },
  'shifting.numbers':{ bn: 'লেবার ও ফ্লোর সংখ্যা সঠিকভাবে দিন।', en: 'Enter valid numbers of labourers and floors.' },
  'medicine.rows': { bn: 'প্রতিটি লাইনের সব ঘর পূরণ করুন।', en: 'Fill every box in each row.' },
  'medicine.details': {
    bn: 'ঠিকানা, মোবাইল নম্বর এবং প্রেসক্রিপশন বা অন্তত একটি ঔষুধের লাইন দিন।',
    en: 'Add the address, mobile number, and a prescription or at least one medicine.',
  },
  'parcel.details': { bn: 'পণ্যের নাম, দুই ঠিকানা ও গ্রহীতার মোবাইল নম্বর দিন।', en: "Add the product name, both addresses and the receiver's mobile." },
  'auth.signup': { bn: 'নাম ও মোবাইল নম্বর দিন।', en: 'Enter your name and mobile number.' },
  'auth.login': { bn: 'মোবাইল নম্বর দিন।', en: 'Enter your mobile number.' },
  'auth.no_account': { bn: 'এই নম্বরে কোনো অ্যাকাউন্ট নেই। সাইন আপ করুন।', en: 'No account with this number. Please sign up.' },
  'auth.invalid': { bn: 'মোবাইল নম্বর বা পাসওয়ার্ড ভুল।', en: 'Wrong mobile number or password.' },
  'auth.blocked': { bn: 'আপনার অ্যাকাউন্ট বন্ধ করা হয়েছে। সাপোর্টে যোগাযোগ করুন।', en: 'Your account is blocked. Please contact support.' },
  'auth.required': { bn: 'আবার লগইন করুন।', en: 'Please log in again.' },
  'mobile.invalid': { bn: 'সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)।', en: 'Enter a valid mobile number (01XXXXXXXXX).' },
  'mobile.taken': { bn: 'এই মোবাইল নম্বরে আগেই অ্যাকাউন্ট আছে।', en: 'An account with this mobile number already exists.' },
  'password.required': { bn: 'পাসওয়ার্ড দিন।', en: 'Enter your password.' },
  'password.short': { bn: 'পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।', en: 'Password must be at least 6 characters.' },
  'password.wrong': { bn: 'বর্তমান পাসওয়ার্ড ভুল।', en: 'The current password is wrong.' },
  'profile.name': { bn: 'নাম দিন।', en: 'Enter your name.' },
  'profile.mobile': { bn: 'মোবাইল নম্বর দিন।', en: 'Enter your mobile number.' },
  'location.required': { bn: 'ম্যাপে লোকেশন বাছুন।', en: 'Pick the location on the map.' },
  'location.pin': { bn: 'ম্যাপ সরিয়ে পিনটি ঠিক জায়গায় বসান।', en: 'Move the map to put the pin on the place.' },
  'location.address': { bn: 'ঠিকানা লিখুন।', en: 'Enter the address.' },
  'location.unavailable': {
    bn: 'আপনার লোকেশন পাওয়া যায়নি। ফোনের লোকেশন চালু করে এই সাইটকে অনুমতি দিন, অথবা ম্যাপে পিন সরান।',
    en: "Couldn't get your location. Turn on location and allow it for this site, or move the pin on the map.",
  },
  'upload.type': { bn: 'শুধু ছবি বা PDF দিন।', en: 'Only a photo or PDF is allowed.' },
  'upload.size': { bn: 'ফাইল ৫ MB-এর বেশি হতে পারবে না।', en: 'The file must be 5 MB or smaller.' },
  'upload.missing': { bn: 'প্রেসক্রিপশন ফাইল পাওয়া যায়নি, আবার এড করুন।', en: 'The prescription file was not found. Please add it again.' },
  'order.not_cancellable': { bn: 'বুক হয়ে যাওয়া অর্ডার বাতিল করা যাবে না।', en: 'This order can no longer be cancelled.' },
  'order.bad_transition': { bn: 'এই অবস্থায় পরিবর্তন করা যাবে না।', en: 'The order cannot move to that status.' },
  'order.bill_locked': { bn: 'গ্রাহক কনফার্ম করার পর দাম আর বদলানো যাবে না।', en: 'Prices are locked once the customer has confirmed.' },
  'order.quote_changed': { bn: 'দাম বদলানো হয়েছে। নতুন দাম দেখে আবার কনফার্ম করুন।', en: 'The price has changed. Check the new price and confirm again.' },
  'quote.items': { bn: 'প্রতিটি লাইনে নাম, পরিমাণ ও দাম দিন।', en: 'Give every line a name, quantity and price.' },
  'quote.fees': { bn: 'মজুরী ও ডেলিভারী খরচ সঠিক অঙ্কে দিন (ঔষুধে মজুরী নেই)।', en: 'Enter valid amounts for the shopping fee and delivery charge (medicine has no shopping fee).' },
  'quote.vehicle': { bn: 'গাড়ী ভাড়া সঠিক অঙ্কে দিন।', en: 'Enter a valid vehicle rent.' },
  'push.endpoint': { bn: 'এই ব্রাউজারে নোটিফিকেশন চালু করা যাচ্ছে না।', en: "Notifications can't be turned on in this browser." },
  'account.active_orders': { bn: 'চলমান অর্ডার শেষ বা বাতিল হলে তারপর অ্যাকাউন্ট মুছতে পারবেন।', en: 'Finish or cancel your running orders first, then delete your account.' },
  'offer.title': { bn: 'অফারের শিরোনাম দিন।', en: 'Enter a title for the offer.' },
  'offer.dates': { bn: 'শুরু ও শেষের তারিখ দিন; শেষ তারিখ শুরুর আগে হতে পারবে না।', en: 'Give a start and end date; the end cannot be before the start.' },
  'offer.image': { bn: 'শুধু JPG, PNG বা WebP ছবি দিন (৫ MB পর্যন্ত)।', en: 'Only a JPG, PNG or WebP picture (up to 5 MB).' },
  'apk.required': { bn: 'APK ফাইলটি বেছে নিন।', en: 'Choose the APK file.' },
  'apk.invalid': { bn: 'এটি অ্যান্ড্রয়েড অ্যাপের APK ফাইল নয়।', en: 'This is not an Android APK file.' },
  'apk.too_large': { bn: 'APK ১৫০ MB-এর বেশি হতে পারবে না।', en: 'The APK must be 150 MB or smaller.' },
  'apk.version': { bn: 'ভার্সন যেমন 1.0.3 এভাবে দিন (৩২ অক্ষর পর্যন্ত)।', en: 'Write the version like 1.0.3 (up to 32 characters).' },
  'system.pg_dump_missing': {
    bn: 'সার্ভারে pg_dump পাওয়া যায়নি। PostgreSQL client tools ইনস্টল করুন, বা .env-এ PG_DUMP_PATH দিন।',
    en: "pg_dump wasn't found on the server. Install the PostgreSQL client tools, or set PG_DUMP_PATH in .env.",
  },
  'system.backup_failed': { bn: 'ব্যাকআপ তৈরি করা যায়নি। সার্ভারের লগ দেখুন।', en: "The backup couldn't be made. Check the server log." },
  'system.backup_busy': { bn: 'আরেকটি ব্যাকআপ তৈরি হচ্ছে, একটু পরে আবার চেষ্টা করুন।', en: 'Another backup is being made. Try again shortly.' },
  'vehicle.unavailable': { bn: 'এই গাড়ীটি এখন পাওয়া যাচ্ছে না।', en: 'This vehicle is not available right now.' },
  'hours.invalid': { bn: 'প্রতিটি সময়ের শুরু ও শেষ দিন; শেষ হবে শুরুর পরে, আর দুটি সময় একটার ওপর আরেকটা পড়বে না।', en: 'Give each window a start and a later end, without overlapping another window.' },
  'range.invalid': { bn: 'তারিখ ঠিকভাবে দিন: শেষ তারিখ শুরুর আগে হবে না, আজকের পরে হবে না, আর সময়কাল এক বছরের বেশি হবে না।', en: 'Check the dates: the end cannot be before the start or after today, and the period can be at most a year.' },
  'role.name_taken': { bn: 'এই নামে আরেকটি রোল আছে।', en: 'Another role already has this name.' },
  'role.in_use': { bn: 'এই রোলে স্টাফ আছেন। আগে তাঁদের অন্য রোল দিন।', en: 'Staff still have this role. Give them another role first.' },
  'role.locked': { bn: 'সুপার অ্যাডমিন রোল বদলানো বা মুছে ফেলা যায় না।', en: 'The Super admin role cannot be changed or deleted.' },
  'role.not_found': { bn: 'রোলটি পাওয়া যায়নি।', en: 'That role was not found.' },
  'admin.super_only': { bn: 'শুধু সুপার অ্যাডমিন এটি করতে পারেন।', en: 'Only a Super admin can do this.' },
  'role.beyond_own': { bn: 'নিজের যে অনুমতি নেই তা দেওয়া বা সরানো যাবে না।', en: 'You can only give or take away permissions you hold yourself.' },
  'role.own': { bn: 'নিজের রোল বদলানো যাবে না।', en: "You can't change your own role." },
  'admin.last_super': { bn: 'অন্তত একজন সক্রিয় সুপার অ্যাডমিন থাকতে হবে।', en: 'There must be at least one active Super admin.' },
  'admin.self': { bn: 'নিজের অ্যাকাউন্ট বন্ধ বা রোল বদল করা যাবে না।', en: 'You cannot deactivate or change the role of your own account.' },
  'field.required': { bn: 'এই ঘরটি পূরণ করুন।', en: 'This field is required.' },
  'field.invalid': { bn: 'তথ্যটি সঠিক নয়।', en: 'This value is not valid.' },
  validation: { bn: 'তথ্যগুলো ঠিকভাবে দিন।', en: 'Please check the information you entered.' },
  forbidden: { bn: 'এই কাজের অনুমতি নেই।', en: 'You are not allowed to do this.' },
  not_found: { bn: 'খুঁজে পাওয়া যায়নি।', en: 'Not found.' },
  conflict: { bn: 'তথ্যটি আগেই আছে।', en: 'This already exists.' },
  rate_limited: { bn: 'অনেকবার চেষ্টা হয়েছে, একটু পরে আবার চেষ্টা করুন।', en: 'Too many attempts. Please try again shortly.' },
  network: { bn: 'সার্ভারে সংযোগ করা যাচ্ছে না।', en: 'Cannot reach the server.' },
  server: { bn: 'কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করুন।', en: 'Something went wrong. Please try again.' },
} as const satisfies Record<string, Text>

export type MessageCode = keyof typeof MESSAGES

export const isMessageCode = (value: unknown): value is MessageCode => typeof value === 'string' && Object.hasOwn(MESSAGES, value)

export const messageText = (code: string | undefined | null): Text => (isMessageCode(code) ? MESSAGES[code] : MESSAGES.server)

/** Body of every API error response. */
export type ApiErrorBody = {
  statusCode: number
  code: MessageCode
  message: Text
  issues?: { path: (string | number)[]; code: string }[]
}

/**
 * Picks the error to show for a form: the first code in `priority` that appears among the
 * issues, so a screen reports problems in the same order the sketches' screens did.
 */
export function pickIssueCode(issueCodes: readonly string[], priority: readonly MessageCode[]): MessageCode {
  for (const code of priority) if (issueCodes.includes(code)) return code
  return issueCodes.find(isMessageCode) ?? 'validation'
}
