import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'format.dart';

/// The two app languages. Bangla is the default, as on the website.
enum Lang {
  bn,
  en;

  static Lang parse(Object? value) => value == 'en' ? Lang.en : Lang.bn;
}

/// A string in both languages (the API's { bn, en }).
class Bilingual {
  const Bilingual(this.bn, this.en);

  factory Bilingual.fromJson(Object? json) {
    final map = (json as Map?) ?? const {};
    return Bilingual('${map['bn'] ?? ''}', '${map['en'] ?? map['bn'] ?? ''}');
  }

  final String bn;
  final String en;

  String of(Lang lang) => lang == Lang.bn ? bn : en;
}

const _bnMonths = ['জানু', 'ফেব', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্ট', 'অক্টো', 'নভেম্বর', 'ডিসে'];
const _enMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

/// The website's language helpers (src/customer/lib/i18n.tsx): every visible string is written as
/// `l.t('বাংলা', 'English')` where it is used.
class L10n {
  const L10n(this.lang);

  final Lang lang;

  bool get isBn => lang == Lang.bn;

  String t(String bn, String en) => isBn ? bn : en;

  String text(Bilingual value) => value.of(lang);

  /// Amounts keep Latin digits in both languages: "230 টাকা" / "Tk 230".
  String taka(int amount) => isBn ? '$amount টাকা' : 'Tk $amount';

  /// Counts and row numbers use Bengali digits in Bangla.
  String digits(Object number) => isBn ? toBnDigits('$number') : '$number';

  /// "১।" / "1."
  String rowNumber(int index) => isBn ? '${digits(index + 1)}।' : '${index + 1}.';

  /// "২৭ অক্টো, ২০২৬" / "27 Oct 2026", and with the time "…, ২:০৫ PM" / "…, 14:05", in Bangladesh
  /// time, exactly as the website prints them. A date-only value (YYYY-MM-DD) is that calendar day.
  String formatDate(String value, {bool withTime = false}) {
    final dateOnly = RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(value);
    final parsed = DateTime.tryParse(dateOnly ? '${value}T00:00:00Z' : value);
    if (parsed == null) return value;
    final d = dateOnly ? parsed : toDhaka(parsed);
    final day = isBn ? '${digits(d.day)} ${_bnMonths[d.month - 1]}, ${digits(d.year)}' : '${d.day} ${_enMonths[d.month - 1]} ${d.year}';
    if (!withTime || dateOnly) return day;
    final minute = d.minute.toString().padLeft(2, '0');
    if (!isBn) return '$day, ${d.hour}:$minute';
    final hour12 = d.hour % 12 == 0 ? 12 : d.hour % 12;
    return '$day, ${digits(hour12)}:${digits(minute)} ${d.hour < 12 ? 'AM' : 'PM'}';
  }
}

const _langKey = 'lang';

/// The chosen language, remembered on the phone. main() reads it before the first frame.
class LangController extends Notifier<Lang> {
  LangController([this._initial = Lang.bn]);

  final Lang _initial;

  @override
  Lang build() => _initial;

  Future<void> set(Lang lang) async {
    state = lang;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_langKey, lang.name);
  }

  static Future<Lang> load() async {
    final prefs = await SharedPreferences.getInstance();
    return Lang.parse(prefs.getString(_langKey));
  }
}

final langProvider = NotifierProvider<LangController, Lang>(LangController.new);

final l10nProvider = Provider<L10n>((ref) => L10n(ref.watch(langProvider)));
