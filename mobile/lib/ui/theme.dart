import 'package:material_ui/material_ui.dart';

import '../core/domain.dart';
import 'lucide.dart';

/// The Kingfisher palette from the website (src/app/(customer)/globals.css, "Kingfisher theme"),
/// drawn from the logo. Screens use these tokens, never raw colours.
abstract final class Kf {
  static const blue = Color(0xFF1265D8);
  static const blueHover = Color(0xFF0F55B8);
  static const blueInk = Color(0xFF174EA6);
  static const blueSoft = Color(0xFFE7F1FF);
  static const blueSoft2 = Color(0xFFDCEAFF);
  static const blueLine = Color(0xFFB9D4FB);
  static const blueTint = Color(0xFFF3F8FF);

  static const teal = Color(0xFF0FB98C);
  static const tealInk = Color(0xFF08745A);
  static const tealSoft = Color(0xFFE3F8F1);
  static const sky = Color(0xFF1A9EE8);
  static const sun = Color(0xFFFFC21A);
  static const coral = Color(0xFFEF4A2B);

  static const navy = Color(0xFF0E1C48);
  static const ink = Color(0xFF172033);
  static const ink2 = Color(0xFF44546A);
  static const muted = Color(0xFF65748B);
  static const muted2 = Color(0xFF8591A5);
  static const muted3 = Color(0xFFA7B2C3);
  static const onNavy = Color(0xFFC7D2E1);

  static const canvas = Color(0xFFF4F7FB);
  static const surface = Color(0xFFFFFFFF);
  static const surface2 = Color(0xFFF7F9FC);
  static const surface3 = Color(0xFFEEF2F7);
  static const line = Color(0xFFE4EAF2);
  static const lineStrong = Color(0xFFD5DEEB);

  static const green = Color(0xFF168447);
  static const greenInk = Color(0xFF176B3A);
  static const greenSoft = Color(0xFFE7F7ED);
  static const greenLine = Color(0xFFBFE5CD);

  static const orange = Color(0xFFFF8738);
  static const orangeIcon = Color(0xFFD96A21);
  static const orangeInk = Color(0xFFA84D12);
  static const orangeSoft = Color(0xFFFFF0E5);
  static const orangeLine = Color(0xFFFFD8BD);

  static const warnInk = Color(0xFFB45309);
  static const warnSoft = Color(0xFFFFF0D9);

  static const violet = Color(0xFF7047C5);
  static const violetInk = Color(0xFF6240AC);
  static const violetSoft = Color(0xFFEEE8FF);
  static const violetTint = Color(0xFFF0EBFF);
  static const violetLine = Color(0xFFD9CDF7);

  static const danger = Color(0xFFDC3545);
  static const dangerInk = Color(0xFFB42330);
  static const dangerSoft = Color(0xFFFDECEC);
  static const dangerLine = Color(0xFFF5C2C7);

  /// --brand-gradient: teal → sky → blue at 120°.
  static const brandGradient = LinearGradient(
    begin: Alignment(-0.87, -0.5),
    end: Alignment(0.87, 0.5),
    colors: [teal, sky, blue],
    stops: [0, 0.45, 1],
  );

  static const radiusCard = 16.0;
  static const radiusControl = 12.0;

  /// --shadow-card
  static const shadowCard = [
    BoxShadow(color: Color(0x0D10213A), blurRadius: 2, offset: Offset(0, 1)),
    BoxShadow(color: Color(0x0F10213A), blurRadius: 24, offset: Offset(0, 8)),
  ];

  /// --shadow-raised
  static const shadowRaised = [BoxShadow(color: Color(0x1A10213A), blurRadius: 32, offset: Offset(0, 12))];

  /// The page gutter (the website's .page-body: 20px, 14px on narrow phones).
  static double gutter(BuildContext context) => MediaQuery.sizeOf(context).width <= 390 ? 14 : 20;
}

/// A service's colours (.svc-bazar … .svc-parcel) and icon.
class ServiceTone {
  const ServiceTone(this.color, this.soft, this.ink, this.line, this.icon);

  final Color color;
  final Color soft;
  final Color ink;
  final Color line;
  final IconData icon;

  static ServiceTone of(ServiceId service) => switch (service) {
    ServiceId.bazar => const ServiceTone(Kf.green, Kf.greenSoft, Kf.greenInk, Kf.greenLine, LucideIcons.shoppingBag),
    ServiceId.shifting => const ServiceTone(Kf.blue, Kf.blueSoft, Kf.blueInk, Kf.blueLine, LucideIcons.truck),
    ServiceId.medicine => const ServiceTone(Kf.orangeIcon, Kf.orangeSoft, Kf.orangeInk, Kf.orangeLine, LucideIcons.pill),
    ServiceId.parcel => const ServiceTone(Kf.violet, Kf.violetTint, Kf.violetInk, Kf.violetLine, LucideIcons.packageCheck),
  };

  /// Offers without a service use the orange tone.
  static const offer = ServiceTone(Kf.orangeIcon, Kf.orangeSoft, Kf.orangeInk, Kf.orangeLine, LucideIcons.badgePercent);
}

/// Inter for Latin text with Hind Siliguri for Bangla, letter-spacing 0 so Bangla keeps its headstroke (মাত্রা).
ThemeData buildTheme() {
  const scheme = ColorScheme(
    brightness: Brightness.light,
    primary: Kf.blue,
    onPrimary: Colors.white,
    primaryContainer: Kf.blueSoft,
    onPrimaryContainer: Kf.blueInk,
    secondary: Kf.teal,
    onSecondary: Colors.white,
    secondaryContainer: Kf.tealSoft,
    onSecondaryContainer: Kf.tealInk,
    tertiary: Kf.orangeIcon,
    onTertiary: Colors.white,
    error: Kf.danger,
    onError: Colors.white,
    errorContainer: Kf.dangerSoft,
    onErrorContainer: Kf.dangerInk,
    surface: Kf.surface,
    onSurface: Kf.ink,
    onSurfaceVariant: Kf.ink2,
    surfaceContainerLowest: Kf.surface,
    surfaceContainerLow: Kf.surface2,
    surfaceContainer: Kf.surface3,
    surfaceContainerHigh: Kf.surface3,
    surfaceContainerHighest: Kf.line,
    outline: Kf.lineStrong,
    outlineVariant: Kf.line,
    shadow: Color(0xFF10213A),
    scrim: Color(0x6610213A),
    inverseSurface: Kf.navy,
    onInverseSurface: Colors.white,
    inversePrimary: Kf.blueSoft2,
    surfaceTint: Colors.transparent,
  );

  final base = ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    fontFamily: 'Inter',
    fontFamilyFallback: const ['HindSiliguri'],
    scaffoldBackgroundColor: Kf.canvas,
    materialTapTargetSize: MaterialTapTargetSize.padded,
  );
  final text = base.textTheme.apply(bodyColor: Kf.ink, displayColor: Kf.navy, fontFamily: 'Inter', fontFamilyFallback: const ['HindSiliguri']);
  TextStyle? zero(TextStyle? style) => style?.copyWith(letterSpacing: 0, height: 1.45);

  final controlShape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(Kf.radiusControl));
  const buttonText = TextStyle(fontSize: 14, fontWeight: FontWeight.w600, letterSpacing: 0);
  OutlineInputBorder border(Color color, [double width = 1]) =>
      OutlineInputBorder(borderRadius: BorderRadius.circular(Kf.radiusControl), borderSide: BorderSide(color: color, width: width));

  return base.copyWith(
    textTheme: text.copyWith(
      headlineSmall: zero(text.headlineSmall)?.copyWith(fontWeight: FontWeight.w700, color: Kf.navy),
      titleLarge: zero(text.titleLarge)?.copyWith(fontSize: 18, fontWeight: FontWeight.w700, color: Kf.navy),
      titleMedium: zero(text.titleMedium)?.copyWith(fontSize: 15, fontWeight: FontWeight.w700, color: Kf.navy),
      titleSmall: zero(text.titleSmall)?.copyWith(fontSize: 13, fontWeight: FontWeight.w600, color: Kf.ink),
      bodyLarge: zero(text.bodyLarge)?.copyWith(fontSize: 15),
      bodyMedium: zero(text.bodyMedium)?.copyWith(fontSize: 14),
      bodySmall: zero(text.bodySmall)?.copyWith(fontSize: 12, color: Kf.muted),
      labelLarge: zero(text.labelLarge)?.copyWith(fontSize: 14, fontWeight: FontWeight.w600),
      labelMedium: zero(text.labelMedium)?.copyWith(fontSize: 12, fontWeight: FontWeight.w600, color: Kf.ink2),
      labelSmall: zero(text.labelSmall)?.copyWith(fontSize: 11),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Kf.surface,
      foregroundColor: Kf.navy,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: Colors.transparent,
      centerTitle: false,
      titleSpacing: 4,
      titleTextStyle: TextStyle(fontFamily: 'Inter', fontFamilyFallback: ['HindSiliguri'], fontSize: 18, fontWeight: FontWeight.w700, color: Kf.navy, letterSpacing: 0),
      shape: Border(bottom: BorderSide(color: Kf.line)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: Kf.blue,
        foregroundColor: Colors.white,
        disabledBackgroundColor: Kf.blue.withValues(alpha: 0.45),
        disabledForegroundColor: Colors.white,
        minimumSize: const Size(48, 48),
        padding: const EdgeInsets.symmetric(horizontal: 18),
        shape: controlShape,
        textStyle: buttonText,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        backgroundColor: Kf.surface,
        foregroundColor: Kf.ink,
        minimumSize: const Size(48, 48),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        side: const BorderSide(color: Kf.lineStrong),
        shape: controlShape,
        textStyle: buttonText,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: Kf.blue, minimumSize: const Size(48, 44), shape: controlShape, textStyle: buttonText),
    ),
    iconButtonTheme: IconButtonThemeData(style: IconButton.styleFrom(minimumSize: const Size(48, 48), foregroundColor: Kf.navy)),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Kf.surface,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      hintStyle: const TextStyle(color: Kf.muted3, fontSize: 14, letterSpacing: 0),
      border: border(Kf.lineStrong),
      enabledBorder: border(Kf.lineStrong),
      focusedBorder: border(Kf.blue, 1.6),
      errorBorder: border(Kf.danger),
      focusedErrorBorder: border(Kf.danger, 1.6),
      disabledBorder: border(Kf.line),
    ),
    cardTheme: CardThemeData(
      color: Kf.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Kf.radiusCard), side: const BorderSide(color: Kf.line)),
    ),
    dividerTheme: const DividerThemeData(color: Kf.line, thickness: 1, space: 1),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: Kf.navy,
      contentTextStyle: const TextStyle(color: Colors.white, fontSize: 14, letterSpacing: 0),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      insetPadding: const EdgeInsets.fromLTRB(16, 0, 16, 96),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: Kf.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      titleTextStyle: const TextStyle(fontFamily: 'Inter', fontFamilyFallback: ['HindSiliguri'], fontSize: 18, fontWeight: FontWeight.w700, color: Kf.navy, letterSpacing: 0),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: Kf.surface,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? Colors.white : Kf.muted2),
      trackColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? Kf.blue : Kf.surface3),
      trackOutlineColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? Kf.blue : Kf.lineStrong),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: Kf.blue),
    datePickerTheme: const DatePickerThemeData(backgroundColor: Kf.surface, surfaceTintColor: Colors.transparent, headerBackgroundColor: Kf.blue, headerForegroundColor: Colors.white),
    timePickerTheme: const TimePickerThemeData(backgroundColor: Kf.surface),
    drawerTheme: const DrawerThemeData(backgroundColor: Kf.surface, surfaceTintColor: Colors.transparent, width: 280),
  );
}
