import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../config.dart';
import '../core/domain.dart';
import '../core/i18n.dart';
import '../core/models.dart';
import 'lucide.dart';
import 'theme.dart';

/// The photo for a service (public/images, Unsplash License).
String servicePhoto(ServiceId service) => 'assets/images/${service.name}-800.webp';

/// One line under each service's name (src/customer/components/banner.tsx).
Bilingual serviceBlurb(ServiceId service) => switch (service) {
  ServiceId.bazar => const Bilingual('বাজারের লিস্ট লিখে দিন, আমরা বাজার করে বাসায় পৌঁছে দেব।', 'Write your list; we do the shopping and bring it home.'),
  ServiceId.shifting => const Bilingual('গাড়ী, লেবার আর ফ্লোর বেছে নিন; দূরত্ব দেখে গাড়ী ভাড়া জানিয়ে দেব।', 'Pick a vehicle, labourers and floors; we price the vehicle by distance.'),
  ServiceId.medicine => const Bilingual('প্রেসক্রিপশন আপলোড করুন, ঔষুধ পৌঁছে যাবে আপনার ঠিকানায়।', 'Upload your prescription and we deliver the medicine.'),
  ServiceId.parcel => const Bilingual('পণ্য এক ঠিকানা থেকে নিয়ে আরেক ঠিকানায় পৌঁছে দিই।', 'We collect a parcel from one address and deliver it to another.'),
};

/// "ডেলিভারি 80 টাকা" or, for shifting, "লেবার 150 টাকা/জন", from the live Catalog.
String serviceCharge(L10n l, Pricing pricing, ServiceId service) => switch (service) {
  ServiceId.bazar => '${l.t('ডেলিভারি', 'Delivery')} ${l.taka(pricing.bazarDeliveryFee)}',
  ServiceId.medicine => '${l.t('ডেলিভারি', 'Delivery')} ${l.taka(pricing.medicineDeliveryFee)}',
  ServiceId.parcel => '${l.t('ডেলিভারি', 'Delivery')} ${l.taka(pricing.parcelDeliveryFee)}',
  ServiceId.shifting => '${l.t('লেবার', 'Labour')} ${l.taka(pricing.wagePerLabourer)}${l.t('/জন', ' each')}',
};

/// The banner on top of the shifting, medicine and parcel forms.
class ServiceBanner extends ConsumerWidget {
  const ServiceBanner({super.key, required this.service, required this.pricing});

  final ServiceId service;
  final Pricing pricing;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    final tone = ServiceTone.of(service);
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: Container(
        constraints: const BoxConstraints(minHeight: 148),
        color: Kf.navy,
        child: Stack(
          children: [
            Positioned.fill(child: Image.asset(servicePhoto(service), fit: BoxFit.cover, excludeFromSemantics: true)),
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [Kf.navy.withValues(alpha: 0.88), Kf.navy.withValues(alpha: 0.55), tone.color.withValues(alpha: 0.25)],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                    child: Icon(tone.icon, size: 20, color: tone.color),
                  ),
                  const SizedBox(height: 10),
                  Semantics(header: true, child: Text(l.text(service.label), style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700, color: Colors.white))),
                  const SizedBox(height: 3),
                  Text(l.text(serviceBlurb(service)), style: const TextStyle(fontSize: 12.5, color: Colors.white, height: 1.45)),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(999)),
                    child: Text(serviceCharge(l, pricing, service), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: tone.ink)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The home screen's banner on the bazar form: running offers, then the four services. Moves on
/// every 5 seconds, except while touched or under reduced motion; swipe and the dots work anytime.
class PromoSlider extends ConsumerStatefulWidget {
  const PromoSlider({super.key, required this.offers, required this.pricing, required this.current, required this.onOpenOffers, required this.onOpenService});

  final List<Offer> offers;
  final Pricing? pricing;
  final ServiceId current;
  final VoidCallback onOpenOffers;
  final ValueChanged<ServiceId> onOpenService;

  @override
  ConsumerState<PromoSlider> createState() => _PromoSliderState();
}

class _PromoSliderState extends ConsumerState<PromoSlider> {
  final _controller = PageController();
  Timer? _timer;
  int _index = 0;
  bool _held = false;

  int get _count => widget.offers.length + ServiceId.values.length;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _restart();
  }

  @override
  void didUpdateWidget(PromoSlider old) {
    super.didUpdateWidget(old);
    if (old.offers.length != widget.offers.length) _restart();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _restart() {
    _timer?.cancel();
    if (_held || _count < 2 || MediaQuery.disableAnimationsOf(context)) return;
    _timer = Timer(const Duration(seconds: 5), () {
      if (!mounted || !_controller.hasClients) return;
      final next = (_index + 1) % _count;
      _controller.animateToPage(next, duration: const Duration(milliseconds: 450), curve: Curves.easeOutCubic);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = ref.watch(l10nProvider);
    return Semantics(
      label: l.t('অফার ও সেবা', 'Offers and services'),
      container: true,
      child: Column(
        children: [
          Listener(
            onPointerDown: (_) {
              _held = true;
              _timer?.cancel();
            },
            onPointerUp: (_) {
              _held = false;
              _restart();
            },
            onPointerCancel: (_) {
              _held = false;
              _restart();
            },
            child: SizedBox(
              height: 186,
              child: PageView.builder(
                controller: _controller,
                itemCount: _count,
                onPageChanged: (index) {
                  setState(() => _index = index);
                  _restart();
                },
                itemBuilder: (context, index) {
                  final label = '${l.digits(index + 1)} / ${l.digits(_count)}';
                  if (index < widget.offers.length) return Semantics(label: label, child: _offerSlide(l, widget.offers[index]));
                  return Semantics(label: label, child: _serviceSlide(l, ServiceId.values[index - widget.offers.length]));
                },
              ),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 0; i < _count; i++)
                Semantics(
                  button: true,
                  selected: i == _index,
                  label: l.t('স্লাইড ${l.digits(i + 1)}', 'Slide ${i + 1}'),
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => _controller.animateToPage(i, duration: const Duration(milliseconds: 350), curve: Curves.easeOutCubic),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 8),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: i == _index ? 22 : 8,
                        height: 8,
                        decoration: BoxDecoration(color: i == _index ? Kf.blue : Kf.lineStrong, borderRadius: BorderRadius.circular(999)),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _frame({required ServiceTone tone, required Widget picture, required Widget content}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: ColoredBox(
          color: Kf.navy,
          child: Stack(
            fit: StackFit.expand,
            children: [
              picture,
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [Kf.navy.withValues(alpha: 0.9), Kf.navy.withValues(alpha: 0.58), tone.color.withValues(alpha: 0.2)],
                  ),
                ),
              ),
              Padding(padding: const EdgeInsets.all(16), child: content),
            ],
          ),
        ),
      ),
    );
  }

  Widget _cta(String label, VoidCallback onTap) => Material(
    color: Colors.white,
    borderRadius: BorderRadius.circular(999),
    child: InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(label, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Kf.navy)),
            const SizedBox(width: 5),
            const Icon(LucideIcons.arrowRight, size: 14, color: Kf.navy),
          ],
        ),
      ),
    ),
  );

  Widget _offerSlide(L10n l, Offer offer) {
    final service = offer.service;
    final tone = service == null ? ServiceTone.offer : ServiceTone.of(service);
    final fallback = Image.asset(service == null ? 'assets/images/hero-800.webp' : servicePhoto(service), fit: BoxFit.cover, excludeFromSemantics: true);
    return _frame(
      tone: tone,
      picture: offer.imageUrl == null
          ? fallback
          : CachedNetworkImage(imageUrl: '${AppConfig.origin}${offer.imageUrl}', fit: BoxFit.cover, errorWidget: (_, _, _) => fallback, placeholder: (_, _) => fallback),
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
            decoration: BoxDecoration(color: Kf.sun, borderRadius: BorderRadius.circular(999)),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(LucideIcons.badgePercent, size: 13, color: Kf.navy),
                const SizedBox(width: 4),
                Text(l.t('আজকের অফার', "Today's offer"), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Kf.navy)),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Text(l.text(offer.title), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white, height: 1.3)),
          if (offer.body != null)
            Text(l.text(offer.body!), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, color: Colors.white, height: 1.45)),
          const Spacer(),
          _cta(l.t('অফার দেখুন', 'See the offer'), widget.onOpenOffers),
        ],
      ),
    );
  }

  Widget _serviceSlide(L10n l, ServiceId service) {
    final tone = ServiceTone.of(service);
    final pricing = widget.pricing;
    return _frame(
      tone: tone,
      picture: Image.asset(servicePhoto(service), fit: BoxFit.cover, excludeFromSemantics: true),
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
            decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.16), borderRadius: BorderRadius.circular(999)),
            child: Text(
              pricing == null ? l.t('আমাদের সেবা', 'Our service') : serviceCharge(l, pricing, service),
              style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Colors.white),
            ),
          ),
          const SizedBox(height: 8),
          Text(l.text(service.label), style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700, color: Colors.white)),
          Text(l.text(serviceBlurb(service)), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, color: Colors.white, height: 1.45)),
          const Spacer(),
          if (service != widget.current) _cta(l.t('অর্ডার করুন', 'Order now'), () => widget.onOpenService(service)),
        ],
      ),
    );
  }
}
