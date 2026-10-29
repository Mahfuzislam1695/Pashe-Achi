import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../ui/lucide.dart';
import '../../config.dart';
import '../../core/api.dart';
import '../../core/data.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../ui/page.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

/// আজকের অফার: the running offers (the website's features/offers.tsx).
class OffersScreen extends ConsumerWidget {
  const OffersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    final offers = ref.watch(offersProvider);
    final value = offers.value;
    return PageScaffold(
      title: l.t('আজকের অফার', "Today's offers"),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(offersProvider.future).then((_) {}, onError: (_) {}),
        child: ListView(
          padding: pagePadding(context),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            if (value != null && value.isEmpty)
              EmptyNote(l.t('আজ কোনো অফার নেই। নতুন অফার এলে নোটিফিকেশন পাবেন।', 'No offers today. You will be notified when a new one starts.'), icon: LucideIcons.badgePercent)
            else if (value != null)
              for (final offer in value) Padding(padding: const EdgeInsets.only(bottom: 14), child: OfferCard(offer: offer))
            else if (offers.hasError)
              ErrorRetry(code: errorCode(offers.error!), onRetry: () => ref.invalidate(offersProvider))
            else
              const LoadingNote(),
          ],
        ),
      ),
    );
  }
}

/// One offer: its picture (or the service's colour and icon), title, text, last day and "Order now".
/// Home shows the same cards in a row.
class OfferCard extends ConsumerWidget {
  const OfferCard({super.key, required this.offer});

  final Offer offer;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    final service = offer.service;
    final tone = service == null ? ServiceTone.offer : ServiceTone.of(service);
    final ends = l.formatDate(offer.endsOn);
    final placeholder = ColoredBox(color: tone.soft, child: Center(child: Icon(tone.icon, size: 40, color: tone.color)));
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(color: Kf.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: Kf.line), boxShadow: Kf.shadowCard),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(
              fit: StackFit.expand,
              children: [
                offer.imageUrl == null
                    ? placeholder
                    : CachedNetworkImage(imageUrl: '${AppConfig.origin}${offer.imageUrl}', fit: BoxFit.cover, placeholder: (_, _) => placeholder, errorWidget: (_, _, _) => placeholder),
                if (service != null)
                  Positioned(
                    top: 10,
                    left: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                      decoration: BoxDecoration(color: Kf.surface, borderRadius: BorderRadius.circular(999)),
                      child: Text(l.text(service.label), style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: tone.ink)),
                    ),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l.text(offer.title), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Kf.navy, height: 1.35)),
                if (offer.body != null) ...[const SizedBox(height: 6), Text(l.text(offer.body!), style: const TextStyle(fontSize: 13.5, color: Kf.ink2, height: 1.55))],
                const SizedBox(height: 10),
                Row(
                  children: [
                    const Icon(LucideIcons.calendarDays, size: 13, color: Kf.muted),
                    const SizedBox(width: 5),
                    Text(offer.startsOn == offer.endsOn ? l.t('শুধু $ends', '$ends only') : l.t('$ends পর্যন্ত', 'Until $ends'), style: const TextStyle(fontSize: 12.5, color: Kf.muted)),
                  ],
                ),
                if (service != null) ...[
                  const SizedBox(height: 12),
                  PrimaryButton(label: l.t('অর্ডার করুন', 'Order now'), icon: LucideIcons.arrowRight, expand: false, onPressed: () => context.go('/${service.name}')),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
