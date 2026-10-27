// The "… ডেলিভারির সময় সূচী" notice above a service form (a port of src/shared/delivery-hours.ts).
// The hours only inform: any delivery time can be picked (owner's rule).
import 'domain.dart';
import 'format.dart';
import 'i18n.dart';
import 'models.dart';

({int hour, int minute, String label}) _clock(String time) {
  final parts = time.split(':');
  final hour = int.tryParse(parts.first) ?? 0;
  final minute = parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0;
  final label = '${hour % 12 == 0 ? 12 : hour % 12}${minute > 0 ? ':${minute.toString().padLeft(2, '0')}' : ''}';
  return (hour: hour, minute: minute, label: label);
}

/// The Bangla part of day an hour falls in.
String _banglaPeriod(int hour) {
  if (hour >= 4 && hour < 6) return 'ভোর';
  if (hour >= 6 && hour < 12) return 'সকাল';
  if (hour >= 12 && hour < 15) return 'দুপুর';
  if (hour >= 15 && hour < 18) return 'বিকাল';
  if (hour >= 18 && hour < 20) return 'সন্ধ্যা';
  return 'রাত';
}

String _join(List<String> parts, String and) =>
    parts.length > 1 ? '${parts.sublist(0, parts.length - 1).join(', ')} $and ${parts.last}' : (parts.firstOrNull ?? '');

/// "সকাল ৮ থেকে ১০ এবং সন্ধ্যা ৬ থেকে ৯" / "8–10 am and 6–9 pm".
Bilingual describeDeliveryHours(List<DeliveryWindow> windows) {
  final sorted = [...windows]..sort((a, b) => a.from.compareTo(b.from));
  final bn = [
    for (final window in sorted)
      () {
        final from = _clock(window.from), to = _clock(window.to);
        // Name the end's part of day only when it crosses noon: "সকাল ১১ থেকে দুপুর ২", but "সন্ধ্যা ৬ থেকে ৯".
        final end = (from.hour < 12) == (to.hour < 12) ? toBnDigits(to.label) : '${_banglaPeriod(to.hour)} ${toBnDigits(to.label)}';
        return '${_banglaPeriod(from.hour)} ${toBnDigits(from.label)} থেকে $end';
      }(),
  ];
  String half(int hour) => hour < 12 ? 'am' : 'pm';
  final en = [
    for (final window in sorted)
      () {
        final from = _clock(window.from), to = _clock(window.to);
        return half(from.hour) == half(to.hour) ? '${from.label}–${to.label} ${half(to.hour)}' : '${from.label} ${half(from.hour)}–${to.label} ${half(to.hour)}';
      }(),
  ];
  return Bilingual(_join(bn, 'এবং'), _join(en, 'and'));
}

/// The notice a service screen shows above its form, or null when the service takes any time.
Bilingual? deliveryHoursNotice(ServiceId service, List<DeliveryWindow> windows) {
  if (windows.isEmpty) return null;
  final hours = describeDeliveryHours(windows);
  // The shifting page never says ডেলিভারি (owner's wording).
  if (service == ServiceId.shifting) return Bilingual('বাসা বদলের সময় সূচী: ${hours.bn} পর্যন্ত।', 'House shifting hours: ${hours.en}.');
  final label = service.label;
  return Bilingual('${label.bn} ডেলিভারির সময় সূচী: ${hours.bn} পর্যন্ত।', '${label.en} delivery hours: ${hours.en}.');
}
