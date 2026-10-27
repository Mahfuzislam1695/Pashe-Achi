// Every error the customer can see, by the code the API returns (src/shared/messages.ts). The API
// sends the text too; these cover the checks the app makes before sending, and the network.
import 'i18n.dart';

const messages = <String, Bilingual>{
  'schedule.required': Bilingual('ডেলিভারি তারিখ ও টাইম দিন।', 'Choose the delivery date and time.'),
  'schedule.past': Bilingual('আজ বা পরের কোনো তারিখ দিন।', 'Choose today or a later date.'),
  'bazar.rows': Bilingual('প্রতিটি লাইনে বাজারের নাম ও পরিমাণ লিখুন।', 'Fill in the item and quantity in each row.'),
  'bazar.details': Bilingual('ঠিকানা, মোবাইল নম্বর ও অন্তত একটি বাজারের লাইন দিন।', 'Add your address, mobile number and at least one item.'),
  'shifting.areas': Bilingual('Loading Area ও Unloading Area দিন।', 'Add the loading and unloading areas.'),
  'shifting.vehicle': Bilingual('একটি গাড়ী বেছে নিন।', 'Choose a vehicle.'),
  'shifting.schedule_required': Bilingual('শিফটিং এর তারিখ ও সময় দিন।', 'Choose the shifting date and time.'),
  'shifting.numbers': Bilingual('লেবার ও ফ্লোর সংখ্যা সঠিকভাবে দিন।', 'Enter valid numbers of labourers and floors.'),
  'medicine.rows': Bilingual('প্রতিটি লাইনের সব ঘর পূরণ করুন।', 'Fill every box in each row.'),
  'medicine.details': Bilingual(
    'ঠিকানা, মোবাইল নম্বর এবং প্রেসক্রিপশন বা অন্তত একটি ঔষুধের লাইন দিন।',
    'Add the address, mobile number, and a prescription or at least one medicine.',
  ),
  'parcel.details': Bilingual('পণ্যের নাম, দুই ঠিকানা ও গ্রহীতার মোবাইল নম্বর দিন।', "Add the product name, both addresses and the receiver's mobile."),
  'auth.signup': Bilingual('নাম ও মোবাইল নম্বর দিন।', 'Enter your name and mobile number.'),
  'auth.login': Bilingual('মোবাইল নম্বর দিন।', 'Enter your mobile number.'),
  'auth.no_account': Bilingual('এই নম্বরে কোনো অ্যাকাউন্ট নেই। সাইন আপ করুন।', 'No account with this number. Please sign up.'),
  'auth.invalid': Bilingual('মোবাইল নম্বর বা পাসওয়ার্ড ভুল।', 'Wrong mobile number or password.'),
  'auth.blocked': Bilingual('আপনার অ্যাকাউন্ট বন্ধ করা হয়েছে। সাপোর্টে যোগাযোগ করুন।', 'Your account is blocked. Please contact support.'),
  'auth.required': Bilingual('আবার লগইন করুন।', 'Please log in again.'),
  'mobile.invalid': Bilingual('সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)।', 'Enter a valid mobile number (01XXXXXXXXX).'),
  'mobile.taken': Bilingual('এই মোবাইল নম্বরে আগেই অ্যাকাউন্ট আছে।', 'An account with this mobile number already exists.'),
  'password.required': Bilingual('পাসওয়ার্ড দিন।', 'Enter your password.'),
  'password.short': Bilingual('পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।', 'Password must be at least 6 characters.'),
  'password.wrong': Bilingual('বর্তমান পাসওয়ার্ড ভুল।', 'The current password is wrong.'),
  'profile.name': Bilingual('নাম দিন।', 'Enter your name.'),
  'profile.mobile': Bilingual('মোবাইল নম্বর দিন।', 'Enter your mobile number.'),
  'location.required': Bilingual('ম্যাপে লোকেশন বাছুন।', 'Pick the location on the map.'),
  'location.pin': Bilingual('ম্যাপ সরিয়ে পিনটি ঠিক জায়গায় বসান।', 'Move the map to put the pin on the place.'),
  'location.address': Bilingual('ঠিকানা লিখুন।', 'Enter the address.'),
  // The app's own wording (the website's mentions "this site").
  'location.unavailable': Bilingual(
    'আপনার লোকেশন পাওয়া যায়নি। ফোনের লোকেশন চালু করে অ্যাপকে অনুমতি দিন, অথবা ম্যাপে পিন সরান।',
    "Couldn't get your location. Turn on location and allow it for the app, or move the pin on the map.",
  ),
  'upload.type': Bilingual('শুধু ছবি বা PDF দিন।', 'Only a photo or PDF is allowed.'),
  'upload.size': Bilingual('ফাইল ৫ MB-এর বেশি হতে পারবে না।', 'The file must be 5 MB or smaller.'),
  'upload.missing': Bilingual('প্রেসক্রিপশন ফাইল পাওয়া যায়নি, আবার এড করুন।', 'The prescription file was not found. Please add it again.'),
  'order.not_cancellable': Bilingual('বুক হয়ে যাওয়া অর্ডার বাতিল করা যাবে না।', 'This order can no longer be cancelled.'),
  'order.bad_transition': Bilingual('এই অবস্থায় পরিবর্তন করা যাবে না।', 'The order cannot move to that status.'),
  'order.quote_changed': Bilingual('দাম বদলানো হয়েছে। নতুন দাম দেখে আবার কনফার্ম করুন।', 'The price has changed. Check the new price and confirm again.'),
  'account.active_orders': Bilingual('চলমান অর্ডার শেষ বা বাতিল হলে তারপর অ্যাকাউন্ট মুছতে পারবেন।', 'Finish or cancel your running orders first, then delete your account.'),
  // The app's own: shown on the welcome screen after the customer deleted their account.
  'account.deleted': Bilingual('আপনার অ্যাকাউন্ট মুছে ফেলা হয়েছে।', 'Your account has been deleted.'),
  'vehicle.unavailable': Bilingual('এই গাড়ীটি এখন পাওয়া যাচ্ছে না।', 'This vehicle is not available right now.'),
  'field.invalid': Bilingual('তথ্যটি সঠিক নয়।', 'This value is not valid.'),
  'validation': Bilingual('তথ্যগুলো ঠিকভাবে দিন।', 'Please check the information you entered.'),
  'forbidden': Bilingual('এই কাজের অনুমতি নেই।', 'You are not allowed to do this.'),
  'not_found': Bilingual('খুঁজে পাওয়া যায়নি।', 'Not found.'),
  'conflict': Bilingual('তথ্যটি আগেই আছে।', 'This already exists.'),
  'rate_limited': Bilingual('অনেকবার চেষ্টা হয়েছে, একটু পরে আবার চেষ্টা করুন।', 'Too many attempts. Please try again shortly.'),
  'network': Bilingual('সার্ভারে সংযোগ করা যাচ্ছে না। ইন্টারনেট দেখে আবার চেষ্টা করুন।', 'Cannot reach the server. Check the internet and try again.'),
  'server': Bilingual('কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করুন।', 'Something went wrong. Please try again.'),
};

bool isMessageCode(String? code) => code != null && messages.containsKey(code);

Bilingual messageText(String? code) => messages[code] ?? messages['server']!;

/// Each form shows one message: the first of these that applies, in the order of the original
/// screens (src/shared/schemas/orders.ts FORM_ERROR_PRIORITY).
const formErrorPriority = <String, List<String>>{
  'bazar': ['bazar.rows', 'bazar.details', 'location.required', 'mobile.invalid', 'schedule.required', 'schedule.past'],
  'shifting': ['shifting.areas', 'location.required', 'schedule.required', 'schedule.past', 'shifting.vehicle', 'shifting.numbers'],
  'medicine': ['medicine.rows', 'medicine.details', 'location.required', 'mobile.invalid', 'schedule.required', 'schedule.past'],
  'parcel': ['parcel.details', 'location.required', 'mobile.invalid', 'schedule.required', 'schedule.past'],
  'signup': ['auth.signup', 'mobile.invalid', 'location.required', 'password.required', 'password.short'],
  'login': ['auth.login', 'mobile.invalid', 'password.required', 'auth.no_account'],
  'profile': ['profile.name', 'profile.mobile', 'mobile.invalid'],
  'location': ['location.required'],
};

/// The first code in [priority] among [issueCodes]; otherwise the first known code; otherwise 'validation'.
String pickIssueCode(List<String> issueCodes, List<String> priority) {
  for (final code in priority) {
    if (issueCodes.contains(code)) return code;
  }
  return issueCodes.firstWhere(isMessageCode, orElse: () => 'validation');
}
