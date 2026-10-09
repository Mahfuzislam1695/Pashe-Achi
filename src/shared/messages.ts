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
  'shifting.numbers': { bn: 'লেবার ও ফ্লোর সংখ্যা সঠিকভাবে দিন।', en: 'Enter valid numbers of labourers and floors.' },
  'medicine.rows': { bn: 'প্রতিটি লাইনের সব ঘর পূরণ করুন।', en: 'Fill every box in each row.' },
  'medicine.details': {
    bn: 'ঠিকানা, মোবাইল নম্বর এবং প্রেসক্রিপশন বা অন্তত একটি ঔষুধের লাইন দিন।',
    en: 'Add the address, mobile number, and a prescription or at least one medicine.',
  },
  'parcel.details': { bn: 'পণ্যের নাম, দুই ঠিকানা ও গ্রহীতার মোবাইল নম্বর দিন।', en: "Add the product name, both addresses and the receiver's mobile." },
  'auth.signup': { bn: 'নাম, মোবাইল নম্বর ও পাসওয়ার্ড দিন।', en: 'Enter your name, mobile number and password.' },
  'auth.login': { bn: 'মোবাইল নম্বর ও পাসওয়ার্ড দিন।', en: 'Enter your mobile number and password.' },
  'auth.invalid': { bn: 'মোবাইল নম্বর বা পাসওয়ার্ড ভুল।', en: 'Wrong mobile number or password.' },
  'auth.blocked': { bn: 'আপনার অ্যাকাউন্ট বন্ধ করা হয়েছে। সাপোর্টে যোগাযোগ করুন।', en: 'Your account is blocked. Please contact support.' },
  'auth.required': { bn: 'আবার লগইন করুন।', en: 'Please log in again.' },
  'mobile.invalid': { bn: 'সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)।', en: 'Enter a valid mobile number (01XXXXXXXXX).' },
  'mobile.taken': { bn: 'এই মোবাইল নম্বরে আগেই অ্যাকাউন্ট আছে।', en: 'An account with this mobile number already exists.' },
  'password.short': { bn: 'পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।', en: 'Password must be at least 6 characters.' },
  'password.wrong': { bn: 'বর্তমান পাসওয়ার্ড ভুল।', en: 'The current password is wrong.' },
  'profile.name': { bn: 'নাম দিন।', en: 'Enter your name.' },
  'profile.mobile': { bn: 'মোবাইল নম্বর দিন।', en: 'Enter your mobile number.' },
  'upload.type': { bn: 'শুধু ছবি বা PDF দিন।', en: 'Only a photo or PDF is allowed.' },
  'upload.size': { bn: 'ফাইল ৫ MB-এর বেশি হতে পারবে না।', en: 'The file must be 5 MB or smaller.' },
  'upload.missing': { bn: 'প্রেসক্রিপশন ফাইল পাওয়া যায়নি, আবার এড করুন।', en: 'The prescription file was not found. Please add it again.' },
  'order.not_cancellable': { bn: 'বুক হয়ে যাওয়া অর্ডার বাতিল করা যাবে না।', en: 'This order can no longer be cancelled.' },
  'order.bad_transition': { bn: 'এই অবস্থায় পরিবর্তন করা যাবে না।', en: 'The order cannot move to that status.' },
  'order.bill_locked': { bn: 'শেষ হওয়া অর্ডারের বিল বদলানো যাবে না।', en: 'The bill of a finished order cannot be changed.' },
  'vehicle.unavailable': { bn: 'এই গাড়ীটি এখন পাওয়া যাচ্ছে না।', en: 'This vehicle is not available right now.' },
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
