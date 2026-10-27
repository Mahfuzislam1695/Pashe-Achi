import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../ui/lucide.dart';
import '../../core/api.dart';
import '../../core/data.dart';
import '../../core/domain.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../ui/page.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

/// অর্ডার হিস্ট্রি: every order, newest first, 20 at a time (the website's features/orders.tsx).
class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    final orders = ref.watch(ordersProvider);
    // The list stays on screen while it refreshes.
    final value = orders.value;
    return PageScaffold(
      title: l.t('অর্ডার হিস্ট্রি', 'Order history'),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(ordersProvider.future).then((_) {}, onError: (_) {}),
        child: NotificationListener<ScrollNotification>(
          onNotification: (scroll) {
            if (scroll.metrics.extentAfter < 400) ref.read(ordersProvider.notifier).loadMore();
            return false;
          },
          child: ListView(
            padding: pagePadding(context),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              if (value != null && value.items.isEmpty) ...[
                EmptyNote(l.t('এখনো কোনো অর্ডার নেই।', 'No orders yet.'), icon: LucideIcons.clipboardList),
                Center(child: PrimaryButton(label: l.t('বাজার করুন', 'Order groceries'), icon: LucideIcons.shoppingBag, expand: false, onPressed: () => context.go('/bazar'))),
              ] else if (value != null) ...[
                for (final order in value.items) Padding(padding: const EdgeInsets.only(bottom: 10), child: OrderCard(order: order)),
                if (value.loadingMore) const LoadingNote(),
                if (value.moreFailed)
                  Center(
                    child: SecondaryButton(label: l.t('আরো দেখুন', 'Show more'), icon: LucideIcons.rotateCw, onPressed: () => ref.read(ordersProvider.notifier).loadMore()),
                  ),
              ] else if (orders.hasError)
                ErrorRetry(code: errorCode(orders.error!), onRetry: () => ref.invalidate(ordersProvider))
              else
                const LoadingNote(),
            ],
          ),
        ),
      ),
    );
  }
}

class OrderCard extends ConsumerWidget {
  const OrderCard({super.key, required this.order});

  final OrderSummary order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    final tone = ServiceTone.of(order.service);
    final awaiting = isAwaitingPrice(order.service, order.status);
    return Material(
      color: Kf.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => context.push('/orders/${Uri.encodeComponent(order.id)}'),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: Kf.line)),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(color: tone.soft, borderRadius: BorderRadius.circular(12)),
                child: Icon(tone.icon, size: 18, color: tone.color),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(child: Text(l.text(order.service.label), style: const TextStyle(fontWeight: FontWeight.w700, color: Kf.navy))),
                        Text(order.code, style: const TextStyle(fontSize: 12, color: Kf.muted)),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(order.summary, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, color: Kf.ink2)),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Expanded(child: Text(l.formatDate(order.createdAt), style: const TextStyle(fontSize: 12, color: Kf.muted))),
                        Text(
                          awaiting ? l.t('দাম আসছে', 'Price coming') : l.taka(order.total),
                          style: TextStyle(fontWeight: FontWeight.w700, color: awaiting ? Kf.orangeInk : Kf.navy, fontSize: 13.5),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    StatusPill(order.status),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
