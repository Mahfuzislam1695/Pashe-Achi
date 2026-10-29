import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import 'core/notifications.dart';
import 'core/session.dart';
import 'features/auth/auth_screens.dart';
import 'features/home/home_screen.dart';
import 'features/notifications/notifications_screen.dart';
import 'features/offers/offers_screen.dart';
import 'features/orders/order_detail_screen.dart';
import 'features/orders/orders_screen.dart';
import 'features/profile/profile_screen.dart';
import 'features/services/bazar_screen.dart';
import 'features/services/medicine_screen.dart';
import 'features/services/parcel_screen.dart';
import 'features/services/shifting_screen.dart';
import 'features/shell/main_shell.dart';

const _signedOutPaths = {'/welcome', '/login', '/signup'};

/// Opening a screen, dialog or sheet closes the keyboard. Otherwise coming back would give the
/// focus, and the keyboard, back to the box typed in last.
class _CloseKeyboardOnPush extends NavigatorObserver {
  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) => FocusManager.instance.primaryFocus?.unfocus();
}

/// The screens. Signed out: welcome, login, sign up. Signed in: Home and the four services as tabs
/// (each keeps its place), with orders, notifications, offers and the profile opened on top.
final routerProvider = Provider<GoRouter>((ref) {
  final changes = ValueNotifier<int>(0);
  ref.listen(sessionProvider, (_, _) => changes.value++);

  final router = GoRouter(
    navigatorKey: rootNavigatorKey,
    observers: [_CloseKeyboardOnPush()],
    initialLocation: '/home',
    refreshListenable: changes,
    redirect: (context, state) {
      final location = state.matchedLocation;
      return switch (ref.read(sessionProvider)) {
        SessionStarting() || SessionOffline() => location == '/starting' ? null : '/starting',
        SignedOut() => _signedOutPaths.contains(location) ? null : '/welcome',
        SignedIn() => _signedOutPaths.contains(location) || location == '/starting' ? '/home' : null,
      };
    },
    routes: [
      GoRoute(path: '/starting', builder: (_, _) => const StartingScreen()),
      GoRoute(path: '/welcome', builder: (_, _) => const WelcomeScreen()),
      GoRoute(path: '/login', builder: (_, _) => const AuthScreen(signup: false)),
      GoRoute(path: '/signup', builder: (_, _) => const AuthScreen(signup: true)),
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => MainShell(shell: shell),
        // Home is branch 0, then the services in ServiceId order (branchOf in main_shell.dart).
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/home', builder: (_, _) => const HomeScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/bazar', builder: (_, _) => const BazarScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/shifting', builder: (_, _) => const ShiftingScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/medicine', builder: (_, _) => const MedicineScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/parcel', builder: (_, _) => const ParcelScreen())]),
        ],
      ),
      GoRoute(path: '/orders', builder: (_, _) => const OrdersScreen()),
      GoRoute(path: '/orders/:id', builder: (_, state) => OrderDetailScreen(id: state.pathParameters['id']!)),
      GoRoute(path: '/notifications', builder: (_, _) => const NotificationsScreen()),
      GoRoute(path: '/offers', builder: (_, _) => const OffersScreen()),
      GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen()),
    ],
  );
  appRouter = router;
  ref.onDispose(() {
    appRouter = null;
    router.dispose();
    changes.dispose();
  });
  return router;
});
