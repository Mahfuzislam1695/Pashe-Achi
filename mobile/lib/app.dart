import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import 'core/i18n.dart';
import 'core/realtime.dart';
import 'router.dart';
import 'ui/theme.dart';
import 'ui/widgets.dart';

class KingfisherApp extends ConsumerWidget {
  const KingfisherApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(langProvider);
    // The live connection follows the signed-in customer.
    ref.watch(realtimeProvider);
    return MaterialApp.router(
      title: appName.of(lang),
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      // The Kingfisher palette is light only, as on the website.
      themeMode: ThemeMode.light,
      locale: lang == Lang.bn ? const Locale('bn', 'BD') : const Locale('en', 'GB'),
      supportedLocales: const [Locale('bn', 'BD'), Locale('en', 'GB')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      routerConfig: ref.watch(routerProvider),
      // flutter_map still builds on package:flutter/material; the bridge gives it this app's theme and
      // localizations until it moves to material_ui.
      // ignore: deprecated_member_use
      builder: (context, child) => MaterialUiCompatibilityBridge(
        // Edge to edge (Android 15+): dark status-bar icons over the white screens; app bars set their own.
        child: AnnotatedRegion<SystemUiOverlayStyle>(
          value: SystemUiOverlayStyle.dark.copyWith(statusBarColor: Colors.transparent, systemNavigationBarColor: Colors.transparent),
          // Large system text is honoured up to 1.3×, so the forms keep their layout.
          child: MediaQuery.withClampedTextScaling(maxScaleFactor: 1.3, child: child ?? const SizedBox.shrink()),
        ),
      ),
    );
  }
}
