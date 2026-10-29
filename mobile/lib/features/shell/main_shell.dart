import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../ui/lucide.dart';
import '../../core/data.dart';
import '../../core/domain.dart';
import '../../core/i18n.dart';
import '../../core/notifications.dart';
import '../../core/realtime.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

/// The shell's branch for a service: Home is branch 0, the services follow in ServiceId order.
int branchOf(ServiceId service) => service.index + 1;

/// The signed-in frame (the website's components/app-shell.tsx in its phone layout): a top bar with
/// the menu, the logo, the language, the bell and the avatar; a floating bottom nav (Home, Orders,
/// Offers, the bazar list, Profile); Chat and Call above it. Home and the four services are the
/// shell's branches; orders, notifications, offers and the profile open on top of it.
class MainShell extends ConsumerStatefulWidget {
  const MainShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  ConsumerState<MainShell> createState() => _MainShellState();
}

class _MainShellState extends ConsumerState<MainShell> {
  late final AppLifecycleListener _lifecycle;

  @override
  void initState() {
    super.initState();
    // Back in front: catch up on what came in meanwhile.
    _lifecycle = AppLifecycleListener(
      onResume: () {
        ref.read(realtimeProvider).resume();
        ref.invalidate(unreadCountProvider);
        ref.invalidate(pushStatusProvider);
      },
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final push = ref.read(pushProvider);
      final route = push.pendingRoute;
      push.pendingRoute = null;
      if (route != null && mounted) context.push(route);
    });
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    super.dispose();
  }

  void _goBranch(int branch) => widget.shell.goBranch(branch, initialLocation: branch == widget.shell.currentIndex);

  void _goService(ServiceId service) => _goBranch(branchOf(service));

  @override
  Widget build(BuildContext context) {
    final l = ref.watch(l10nProvider);
    final customer = ref.watch(customerProvider);
    final catalog = ref.watch(catalogProvider);
    if (customer == null) return const Scaffold(body: SizedBox.shrink());

    // Like the website, the shell waits for the catalog (prices, vehicles, support line).
    if (!catalog.hasValue) {
      return Scaffold(
        backgroundColor: Kf.surface,
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Image.asset('assets/logo/logo-512.webp', width: 96, height: 96),
                  const SizedBox(height: 20),
                  if (catalog.hasError)
                    ErrorRetry(code: 'network', onRetry: () => ref.invalidate(catalogProvider))
                  else
                    const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2.4)),
                ],
              ),
            ),
          ),
        ),
      );
    }

    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final index = widget.shell.currentIndex;
    final offerCount = ref.watch(offersProvider).value?.length ?? 0;
    // Back from a service goes Home first; back on Home leaves the app.
    return PopScope(
      canPop: index == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) widget.shell.goBranch(0);
      },
      child: Scaffold(
        drawer: _AppDrawer(current: index == 0 ? null : ServiceId.values[index - 1], onHome: () => _goBranch(0), onService: _goService),
        appBar: AppBar(
          toolbarHeight: 64,
          automaticallyImplyLeading: false,
          titleSpacing: 0,
          leading: Builder(
            builder: (context) => IconButton(
              tooltip: l.t('মেনু খুলুন', 'Open menu'),
              icon: const Icon(LucideIcons.menu, size: 22),
              onPressed: () => Scaffold.of(context).openDrawer(),
            ),
          ),
          title: const KfLogo(),
          actions: [
            const LangToggle(compact: true),
            const SizedBox(width: 4),
            const _BellButton(),
            Padding(
              padding: const EdgeInsets.only(right: 10),
              child: IconButton(
                tooltip: l.t('প্রোফাইল', 'Profile'),
                onPressed: () => context.push('/profile'),
                icon: Avatar(customer.name),
              ),
            ),
          ],
        ),
        body: Stack(
          children: [
            Positioned.fill(child: widget.shell),
            if (!keyboardOpen(context)) ...[
              Positioned(left: 0, right: 0, bottom: 90 + bottomInset, child: const Center(child: ContactDock())),
              Positioned(
                left: 10,
                right: 10,
                bottom: 10 + bottomInset,
                // After the mockup's হোম · অর্ডার · … · প্রোফাইল; its cart is the bazar list.
                child: _BottomNav(
                  tabs: [
                    _Tab(LucideIcons.house, l.t('হোম', 'Home'), selected: index == 0, onTap: () => _goBranch(0)),
                    _Tab(LucideIcons.clipboardList, l.t('অর্ডার', 'Orders'), onTap: () => context.push('/orders')),
                    _Tab(LucideIcons.badgePercent, l.t('অফার', 'Offers'), count: offerCount, onTap: () => context.push('/offers')),
                    _Tab(LucideIcons.shoppingBag, l.t('বাজার লিস্ট', 'Bazar list'), selected: index == branchOf(ServiceId.bazar), onTap: () => _goService(ServiceId.bazar)),
                    _Tab(LucideIcons.userRound, l.t('প্রোফাইল', 'Profile'), onTap: () => context.push('/profile')),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _BellButton extends ConsumerWidget {
  const _BellButton();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    final unread = ref.watch(unreadCountProvider).value ?? 0;
    return IconButton(
      tooltip: unread > 0 ? l.t('নোটিফিকেশন, ${l.digits(unread)}টি নতুন', 'Notifications, $unread new') : l.t('নোটিফিকেশন', 'Notifications'),
      onPressed: () => context.push('/notifications'),
      icon: Badge(
        isLabelVisible: unread > 0,
        backgroundColor: Kf.danger,
        label: Text(unread > 99 ? '99+' : l.digits(unread), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700)),
        child: const Icon(LucideIcons.bell, size: 21, color: Kf.navy),
      ),
    );
  }
}

/// One bottom nav item: a branch of the shell (selected while open) or a screen pushed on top.
class _Tab {
  const _Tab(this.icon, this.label, {required this.onTap, this.selected = false, this.count = 0});

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool selected;

  /// A badge on the icon (running offers); 0 shows none.
  final int count;
}

class _BottomNav extends ConsumerWidget {
  const _BottomNav({required this.tabs});

  final List<_Tab> tabs;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    return Container(
      height: 68,
      decoration: BoxDecoration(
        color: Kf.surface.withValues(alpha: 0.97),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Kf.line),
        boxShadow: Kf.shadowRaised,
      ),
      child: Row(
        children: [
          for (final tab in tabs)
            Expanded(
              child: Semantics(
                selected: tab.selected,
                button: true,
                label: tab.count > 0 ? '${tab.label}, ${l.digits(tab.count)}' : tab.label,
                excludeSemantics: true,
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: tab.onTap,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 3),
                        decoration: BoxDecoration(color: tab.selected ? Kf.blueSoft : Colors.transparent, borderRadius: BorderRadius.circular(999)),
                        child: Badge(
                          isLabelVisible: tab.count > 0,
                          backgroundColor: Kf.orange,
                          label: Text(l.digits(tab.count), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700)),
                          child: Icon(tab.icon, size: 20, color: tab.selected ? Kf.blue : Kf.muted2),
                        ),
                      ),
                      const SizedBox(height: 4),
                      // A long label shrinks to fit rather than being cut.
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 3),
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(
                            tab.label,
                            maxLines: 1,
                            style: TextStyle(fontSize: 11, fontWeight: tab.selected ? FontWeight.w700 : FontWeight.w500, color: tab.selected ? Kf.blue : Kf.muted),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _AppDrawer extends ConsumerWidget {
  const _AppDrawer({required this.current, required this.onHome, required this.onService});

  /// The open service, or null on Home.
  final ServiceId? current;
  final VoidCallback onHome;
  final ValueChanged<ServiceId> onService;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    final customer = ref.watch(customerProvider);
    final offerCount = ref.watch(offersProvider).value?.length ?? 0;
    if (customer == null) return const SizedBox.shrink();

    void go(String path) {
      Scaffold.of(context).closeDrawer();
      context.push(path);
    }

    Widget label(String text) => Padding(
      padding: const EdgeInsets.fromLTRB(14, 18, 14, 6),
      child: Text(text, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Kf.muted2)),
    );

    Widget item({required IconData icon, required String text, required VoidCallback onTap, bool active = false, Widget? trailing}) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 1),
        child: Material(
          color: active ? Kf.blueSoft : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: onTap,
            child: Container(
              height: 48,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: active ? const BoxDecoration(border: Border(left: BorderSide(color: Kf.blue, width: 3))) : null,
              child: Row(
                children: [
                  Icon(icon, size: 19, color: active ? Kf.blue : Kf.ink2),
                  const SizedBox(width: 12),
                  Expanded(child: Text(text, style: TextStyle(fontSize: 14, fontWeight: active ? FontWeight.w700 : FontWeight.w500, color: active ? Kf.blue : Kf.ink))),
                  ?trailing,
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Drawer(
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 6, 6),
              child: Row(
                children: [
                  const Expanded(child: KfLogo()),
                  IconButton(tooltip: l.t('মেনু বন্ধ করুন', 'Close menu'), icon: const Icon(LucideIcons.x, size: 20), onPressed: () => Scaffold.of(context).closeDrawer()),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                children: [
                  Material(
                    color: Kf.surface2,
                    borderRadius: BorderRadius.circular(14),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(14),
                      onTap: () => go('/profile'),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            Avatar(customer.name, size: 40),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(customer.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, color: Kf.navy)),
                                  Text('${customer.mobile} · ${l.t('point', 'Points')} ${customer.points}', style: const TextStyle(fontSize: 12, color: Kf.muted)),
                                ],
                              ),
                            ),
                            const Icon(LucideIcons.chevronRight, size: 16, color: Kf.muted2),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  item(
                    icon: LucideIcons.house,
                    text: l.t('হোম', 'Home'),
                    active: current == null,
                    onTap: () {
                      Scaffold.of(context).closeDrawer();
                      onHome();
                    },
                  ),
                  label(l.t('সেবাসমূহ', 'Services')),
                  for (final service in ServiceId.values)
                    item(
                      icon: ServiceTone.of(service).icon,
                      text: l.text(service.label),
                      active: service == current,
                      onTap: () {
                        Scaffold.of(context).closeDrawer();
                        onService(service);
                      },
                    ),
                  item(
                    icon: LucideIcons.badgePercent,
                    text: l.t('আজকের অফার', "Today's offers"),
                    onTap: () => go('/offers'),
                    trailing: offerCount > 0
                        ? Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
                            decoration: BoxDecoration(color: Kf.orange, borderRadius: BorderRadius.circular(999)),
                            child: Text(l.digits(offerCount), style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700)),
                          )
                        : null,
                  ),
                  label(l.t('অ্যাকাউন্ট', 'Account')),
                  item(icon: LucideIcons.clipboardList, text: l.t('অর্ডার হিস্ট্রি', 'Order history'), onTap: () => go('/orders')),
                  item(icon: LucideIcons.bell, text: l.t('নোটিফিকেশন', 'Notifications'), onTap: () => go('/notifications')),
                  item(icon: LucideIcons.userRound, text: l.t('প্রোফাইল', 'Profile'), onTap: () => go('/profile')),
                ],
              ),
            ),
            const Divider(),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 6, 10, 4),
              child: item(icon: LucideIcons.logOut, text: l.t('সাইন আউট', 'Sign out'), onTap: () => confirmSignOut(context, ref)),
            ),
            const Padding(padding: EdgeInsets.only(bottom: 12, top: 4), child: DeveloperCredit()),
          ],
        ),
      ),
    );
  }
}

/// Asks before signing out (the website signs out at once; a phone tap is easier to make by mistake).
Future<void> confirmSignOut(BuildContext context, WidgetRef ref) async {
  final l = ref.read(l10nProvider);
  final yes = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(l.t('সাইন আউট করবেন?', 'Sign out?')),
      content: Text(l.t('আবার লগইন করলে সব অর্ডার আগের মতোই পাবেন।', 'Your orders will be here when you log in again.')),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(false), child: Text(l.t('থাক', 'Stay'))),
        TextButton(onPressed: () => Navigator.of(context).pop(true), child: Text(l.t('সাইন আউট', 'Sign out'))),
      ],
    ),
  );
  if (yes == true) unawaited(ref.read(sessionProvider.notifier).signOut());
}
