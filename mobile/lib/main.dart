import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import 'app.dart';
import 'core/i18n.dart';
import 'core/notifications.dart';
import 'core/session.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final lang = await LangController.load();
  final container = ProviderContainer(
    overrides: [langProvider.overrideWith(() => LangController(lang))],
    // Screens offer "Try again" themselves; nothing is retried behind the customer's back.
    retry: (_, _) => null,
  );
  // Notifications first, so a tap that opened the app is remembered; then the saved session.
  await container.read(pushProvider).init();
  unawaited(container.read(sessionProvider.notifier).restore());
  runApp(UncontrolledProviderScope(container: container, child: const KingfisherApp()));
}
