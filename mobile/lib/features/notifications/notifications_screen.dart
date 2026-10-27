import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../ui/lucide.dart';
import '../../core/api.dart';
import '../../core/data.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/notifications.dart';
import '../../core/session.dart' show apiProvider;
import '../../ui/page.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

/// নোটিফিকেশন: order updates, offers and announcements (the website's features/notifications.tsx),
/// with the switch for popups on this phone.
class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  Future<void> _open(BuildContext context, WidgetRef ref, AppNotification notification) async {
    if (notification.isUnread) {
      ref.read(notificationsProvider.notifier).markReadLocally(notification.id);
      ref.read(unreadCountProvider.notifier).add(-1);
      unawaited(ref.read(apiProvider).markRead(notification.id).catchError((_) {}));
    }
    if (notification.orderId != null) {
      await context.push('/orders/${Uri.encodeComponent(notification.orderId!)}');
    } else if (notification.offerId != null) {
      await context.push('/offers');
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    final list = ref.watch(notificationsProvider);
    final value = list.value;
    final unread = ref.watch(unreadCountProvider).value ?? 0;

    return PageScaffold(
      title: l.t('নোটিফিকেশন', 'Notifications'),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(unreadCountProvider);
          await ref.refresh(notificationsProvider.future).then((_) {}, onError: (_) {});
        },
        child: NotificationListener<ScrollNotification>(
          onNotification: (scroll) {
            if (scroll.metrics.extentAfter < 400) ref.read(notificationsProvider.notifier).loadMore();
            return false;
          },
          child: ListView(
            padding: pagePadding(context),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              const _PushSetting(),
              const SizedBox(height: 12),
              if (unread > 0)
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    onPressed: () async {
                      try {
                        await ref.read(apiProvider).markAllRead();
                      } catch (_) {}
                      ref.invalidate(notificationsProvider);
                      ref.invalidate(unreadCountProvider);
                    },
                    icon: const Icon(LucideIcons.checkCheck, size: 15),
                    label: Text(l.t('সব পড়া হয়েছে', 'Mark all as read')),
                  ),
                ),
              if (value != null && value.items.isEmpty)
                EmptyNote(l.t('এখনো কোনো নোটিফিকেশন নেই।', 'No notifications yet.'), icon: LucideIcons.bell)
              else if (value != null) ...[
                for (final notification in value.items)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _NotificationTile(notification: notification, onTap: () => _open(context, ref, notification)),
                  ),
                if (value.loadingMore) const LoadingNote(),
                if (value.moreFailed)
                  Center(
                    child: SecondaryButton(label: l.t('আরো দেখুন', 'Show more'), icon: LucideIcons.rotateCw, onPressed: () => ref.read(notificationsProvider.notifier).loadMore()),
                  ),
              ] else if (list.hasError)
                ErrorRetry(code: errorCode(list.error!), onRetry: () => ref.invalidate(notificationsProvider))
              else
                const LoadingNote(),
            ],
          ),
        ),
      ),
    );
  }
}

class _NotificationTile extends ConsumerWidget {
  const _NotificationTile({required this.notification, required this.onTap});

  final AppNotification notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    final unread = notification.isUnread;
    return Semantics(
      label: unread ? l.t('নতুন', 'New') : null,
      child: Material(
        color: unread ? Kf.blueTint : Kf.surface,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: unread ? Kf.blueSoft2 : Kf.line)),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Container(width: 8, height: 8, decoration: BoxDecoration(color: unread ? Kf.blue : Kf.lineStrong, shape: BoxShape.circle)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l.text(notification.title), style: const TextStyle(fontWeight: FontWeight.w700, color: Kf.navy, height: 1.4)),
                      const SizedBox(height: 3),
                      Text(l.text(notification.body), style: const TextStyle(fontSize: 13, color: Kf.ink2, height: 1.5)),
                      const SizedBox(height: 5),
                      Text(l.formatDate(notification.createdAt, withTime: true), style: const TextStyle(fontSize: 11.5, color: Kf.muted)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Phone notifications: on or off for this phone, and why when the phone blocks them.
class _PushSetting extends ConsumerStatefulWidget {
  const _PushSetting();

  @override
  ConsumerState<_PushSetting> createState() => _PushSettingState();
}

class _PushSettingState extends ConsumerState<_PushSetting> {
  bool _busy = false;
  bool _failed = false;

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _failed = false;
    });
    try {
      await action();
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = ref.watch(l10nProvider);
    final status = ref.watch(pushStatusProvider).value;
    if (status == null) return const SizedBox.shrink();
    final push = ref.read(pushProvider);
    final on = status == PushStatus.on;
    final hint = switch (status) {
      PushStatus.on when push.hasFirebase => l.t('দাম, অর্ডারের খবর ও অফার অ্যাপ বন্ধ থাকলেও পপআপ হয়ে আসবে।', 'Prices, order updates and offers pop up even when the app is closed.'),
      PushStatus.on => l.t('অ্যাপ খোলা বা পেছনে চালু থাকলে দাম ও অর্ডারের খবর পপআপ হয়ে আসবে।', 'While the app is open or running in the background, prices and order updates pop up.'),
      PushStatus.off => l.t('চালু করলে দাম ও অর্ডারের খবর ফোনে পপআপ হয়ে আসবে।', 'Turn them on to get prices and order updates as popups on this phone.'),
      PushStatus.blocked => l.t('ফোনের সেটিংসে এই অ্যাপের নোটিফিকেশন বন্ধ করা আছে। সেটিংস থেকে চালু করুন।', "Notifications are off for this app in the phone's settings. Turn them on there."),
    };
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: on ? Kf.blueTint : Kf.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: on ? Kf.blueLine : Kf.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(on ? LucideIcons.bellRing : LucideIcons.bellOff, size: 20, color: on ? Kf.blue : Kf.muted),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  on ? l.t('ফোনে নোটিফিকেশন: চালু', 'Phone notifications: on') : l.t('ফোনে নোটিফিকেশন: বন্ধ', 'Phone notifications: off'),
                  style: const TextStyle(fontWeight: FontWeight.w700, color: Kf.navy),
                ),
              ),
              if (status == PushStatus.blocked)
                TextButton(onPressed: push.openSettings, child: Text(l.t('সেটিংস', 'Settings')))
              else
                Switch(
                  value: on,
                  onChanged: _busy ? null : (value) => _run(() async => value ? await push.turnOn() : await push.turnOff()),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Text(hint, style: const TextStyle(fontSize: 12.5, color: Kf.muted, height: 1.5)),
          if (_failed) ...[
            const SizedBox(height: 6),
            Text(l.t('চালু করা যায়নি। আবার চেষ্টা করুন।', "Couldn't turn them on. Try again."), style: const TextStyle(fontSize: 12.5, color: Kf.dangerInk)),
          ],
        ],
      ),
    );
  }
}
