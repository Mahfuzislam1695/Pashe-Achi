// Small formatting rules shared by every screen (ports of src/shared/format.ts).

const _bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/// 0-9 → ০-৯, leaving everything else (a decimal point, letters) as it is.
String toBnDigits(String value) => value.replaceAllMapped(RegExp(r'[0-9]'), (m) => _bnDigits[int.parse(m[0]!)]);

/// ০-৯ → 0-9.
String toLatinDigits(String value) =>
    value.replaceAllMapped(RegExp('[০-৯]'), (m) => '${_bnDigits.indexOf(m[0]!)}');

/// A Bangladeshi mobile number as the API stores it: Bengali digits made Latin; spaces, dashes,
/// brackets and dots dropped; a leading +880/880 removed; a 10-digit number starting with 1 gets its 0.
String normalizeMobile(String value) {
  var digits = toLatinDigits(value).trim().replaceAll(RegExp(r'[\s\-().]'), '');
  if (digits.startsWith('+')) digits = digits.substring(1);
  if (digits.startsWith('880')) digits = digits.substring(3);
  if (digits.length == 10 && digits.startsWith('1')) digits = '0$digits';
  return digits;
}

final mobilePattern = RegExp(r'^01[3-9]\d{8}$');

/// Blank, negative or invalid input → 0, rounded (src/shared/format.ts toAmount).
int toAmount(Object? value) {
  final number = switch (value) {
    final num n => n.toDouble(),
    final String s => double.tryParse(s.trim()) ?? 0,
    _ => 0.0,
  };
  if (number.isNaN || number <= 0) return 0;
  return number.round();
}

/// Bangladesh has no daylight saving: always UTC+6.
const _dhakaOffset = Duration(hours: 6);

DateTime nowInDhaka() => DateTime.now().toUtc().add(_dhakaOffset);

/// A UTC instant as Dhaka wall-clock fields (the result's isUtc is true, but its fields are Dhaka's).
DateTime toDhaka(DateTime instant) => instant.toUtc().add(_dhakaOffset);

String _two(int n) => n.toString().padLeft(2, '0');

/// YYYY-MM-DD of a Dhaka day.
String isoDate(DateTime dhakaDay) => '${dhakaDay.year}-${_two(dhakaDay.month)}-${_two(dhakaDay.day)}';

/// Today in Bangladesh as YYYY-MM-DD (src/shared/format.ts isoDateInBd).
String isoDateInBd() => isoDate(nowInDhaka());

/// HH:mm.
String hhmm(int hour, int minute) => '${_two(hour)}:${_two(minute)}';
