import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api.dart';
import '../../core/data.dart';
import '../../core/domain.dart';
import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/session.dart';
import '../../ui/banners.dart';
import '../../ui/location_sheet.dart';
import '../../ui/lucide.dart';
import '../../ui/theme.dart';
import '../offers/offers_screen.dart';
import '../services/drafts.dart';
import '../services/service_frame.dart';
import '../shell/main_shell.dart';

/// One of the bazar's categories on Home. A tap starts a bazar list row with its name.
class _Category {
  const _Category(this.photo, this.name, this.tone);

  /// assets/images/cat-{photo}-400.webp (src/shared/brand.ts CATEGORY_PHOTOS lists the sources).
  final String photo;
  final Bilingual name;
  final ServiceTone tone;
}

String _categoryPhoto(String photo) => 'assets/images/cat-$photo-400.webp';

final _coral = ServiceTone(
  Kf.coral,
  Color.alphaBlend(Kf.coral.withValues(alpha: 0.11), Kf.surface),
  Color.lerp(Kf.coral, Kf.navy, 0.38)!,
  Color.alphaBlend(Kf.coral.withValues(alpha: 0.28), Kf.surface),
  LucideIcons.beef,
);

final _categories = [
  const _Category('fish', Bilingual('মাছ', 'Fish'), ServiceTone(Kf.blue, Kf.blueSoft, Kf.blueInk, Kf.blueLine, LucideIcons.fish)),
  _Category('meat', const Bilingual('মাংস', 'Meat'), _coral),
  const _Category('vegetables', Bilingual('সবজি', 'Vegetables'), ServiceTone(Kf.green, Kf.greenSoft, Kf.greenInk, Kf.greenLine, LucideIcons.carrot)),
  const _Category('rice', Bilingual('চাল-ডাল', 'Rice & lentils'), ServiceTone(Kf.orangeIcon, Kf.orangeSoft, Kf.orangeInk, Kf.orangeLine, LucideIcons.wheat)),
  const _Category('daily', Bilingual('দৈনন্দিন পণ্য', 'Daily needs'), ServiceTone(Kf.violet, Kf.violetTint, Kf.violetInk, Kf.violetLine, LucideIcons.shoppingBasket)),
];

const _more = ServiceTone(Kf.muted, Kf.surface2, Kf.ink2, Kf.line, LucideIcons.layoutGrid);

/// Home, where the app opens (the website's features/home.tsx): the customer's location, a search
/// that writes the bazar list, the fresh market banner, the bazar's categories, the four services and
/// আজকের অফার. There is no product catalog: categories and searches become bazar list rows.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    final catalog = ref.watch(catalogProvider).value;
    if (catalog == null) return const SizedBox.shrink();
    final offers = ref.watch(offersProvider).value ?? const [];
    final gutter = Kf.gutter(context);

    void openService(ServiceId service) => StatefulNavigationShell.of(context).goBranch(branchOf(service));
    void openBazar([String? item]) {
      if (item != null) addBazarItem(ref, item);
      openService(ServiceId.bazar);
    }

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(catalogProvider);
        ref.invalidate(offersProvider);
        try {
          await ref.read(offersProvider.future);
        } catch (_) {
          // The sections show what loaded.
        }
      },
      child: ListView(
        padding: EdgeInsets.fromLTRB(gutter, 10, gutter, shellBottomSpace + MediaQuery.paddingOf(context).bottom),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 720),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const _LocationRow(),
                  const SizedBox(height: 8),
                  _HomeSearch(onAdd: openBazar, onService: openService),
                  const SizedBox(height: 16),
                  _Hero(onOrder: () => openBazar()),
                  const SizedBox(height: 22),
                  _Heading(l.t('কাঁচা বাজার', 'Fresh market')),
                  const SizedBox(height: 10),
                  GridView.count(
                    crossAxisCount: MediaQuery.sizeOf(context).width >= 600 ? 6 : 3,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 0.92,
                    children: [
                      for (final category in _categories)
                        _CategoryTile(photo: category.photo, label: l.text(category.name), tone: category.tone, onTap: () => openBazar(l.text(category.name))),
                      _CategoryTile(photo: 'more', label: l.t('আরও', 'More'), tone: _more, onTap: () => openBazar()),
                    ],
                  ),
                  const SizedBox(height: 22),
                  _Heading(l.t('আমাদের সেবা', 'Our services')),
                  const SizedBox(height: 10),
                  GridView.count(
                    crossAxisCount: MediaQuery.sizeOf(context).width >= 600 ? 4 : 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 1.9,
                    children: [
                      for (final service in ServiceId.values)
                        _ServiceTile(service: service, charge: serviceCharge(l, catalog.pricing, service), onTap: () => openService(service)),
                    ],
                  ),
                  if (offers.isNotEmpty) ...[
                    const SizedBox(height: 22),
                    _Heading(
                      l.t('আজকের বিশেষ অফার', "Today's special offers"),
                      action: TextButton(
                        onPressed: () => context.push('/offers'),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [Text(l.t('সব দেখুন', 'See all')), const Icon(LucideIcons.chevronRight, size: 15)]),
                      ),
                    ),
                    const SizedBox(height: 10),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      clipBehavior: Clip.none,
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (final (i, offer) in offers.indexed)
                            Padding(
                              padding: EdgeInsets.only(right: i == offers.length - 1 ? 0 : 12),
                              child: SizedBox(width: 280, child: OfferCard(offer: offer)),
                            ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.title, {this.action});

  final String title;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Semantics(header: true, child: Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Kf.navy)))),
        ?action,
      ],
    );
  }
}

/// The delivery location (আমার লোকেশন) at the top; a tap changes it on the map, as in Profile.
class _LocationRow extends ConsumerWidget {
  const _LocationRow();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    final location = ref.watch(customerProvider)?.location;
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => pickPlace(
        context,
        title: l.t('আমার লোকেশন', 'My location'),
        initial: location,
        submitLabel: l.t('সেভ করুন', 'Save'),
        onSave: (place) async {
          final updated = await ref.read(apiProvider).setLocation(place);
          ref.read(sessionProvider.notifier).updateCustomer(updated);
        },
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 6),
        child: Row(
          children: [
            const Icon(LucideIcons.mapPin, size: 19, color: Kf.blue),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l.t('ডেলিভারি লোকেশন', 'Delivery location'), style: const TextStyle(fontSize: 11.5, color: Kf.muted)),
                  Text(
                    location == null ? l.t('ম্যাপে লোকেশন দিন', 'Set your location') : shortArea(location.address),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700, color: Kf.navy),
                  ),
                ],
              ),
            ),
            const Icon(LucideIcons.chevronDown, size: 17, color: Kf.muted2),
          ],
        ),
      ),
    );
  }
}

/// "কী খুঁজছেন?": suggests the services and categories that match, and always offers to put the
/// words on the bazar list (the keyboard's Go does that too).
class _HomeSearch extends ConsumerStatefulWidget {
  const _HomeSearch({required this.onAdd, required this.onService});

  final ValueChanged<String> onAdd;
  final ValueChanged<ServiceId> onService;

  @override
  ConsumerState<_HomeSearch> createState() => _HomeSearchState();
}

class _HomeSearchState extends ConsumerState<_HomeSearch> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _add(String item) {
    FocusScope.of(context).unfocus();
    _controller.clear();
    setState(() {});
    widget.onAdd(item);
  }

  @override
  Widget build(BuildContext context) {
    final l = ref.watch(l10nProvider);
    final words = _controller.text.trim();
    final needle = words.toLowerCase();
    bool matches(Bilingual label) => needle.isNotEmpty && (label.bn.contains(words) || label.en.toLowerCase().contains(needle));
    final services = ServiceId.values.where((service) => matches(service.label));
    final categories = _categories.where((category) => matches(category.name));

    Widget suggestion({IconData? icon, String? photo, Color? color, required String label, required VoidCallback onTap}) => InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 10, vertical: photo == null ? 12 : 8),
        child: Row(
          children: [
            if (photo != null)
              ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.asset(_categoryPhoto(photo), width: 28, height: 28, fit: BoxFit.cover, excludeFromSemantics: true))
            else
              Icon(icon, size: 17, color: color),
            const SizedBox(width: 10),
            Expanded(child: Text(label, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: Kf.ink))),
          ],
        ),
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _controller,
          onChanged: (_) => setState(() {}),
          onSubmitted: (value) {
            if (value.trim().isNotEmpty) _add(value.trim());
          },
          textInputAction: TextInputAction.go,
          decoration: InputDecoration(
            hintText: l.t('কী খুঁজছেন? (মাছ, সবজি, মাংস...)', 'What do you need? (fish, vegetables, meat...)'),
            prefixIcon: const Icon(LucideIcons.search, size: 18),
          ),
        ),
        if (words.isNotEmpty)
          Container(
            margin: const EdgeInsets.only(top: 6),
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(color: Kf.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: Kf.line), boxShadow: Kf.shadowCard),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final service in services)
                  suggestion(icon: ServiceTone.of(service).icon, color: ServiceTone.of(service).color, label: l.text(service.label), onTap: () {
                    FocusScope.of(context).unfocus();
                    widget.onService(service);
                  }),
                for (final category in categories)
                  suggestion(photo: category.photo, label: l.text(category.name), onTap: () => _add(l.text(category.name))),
                suggestion(
                  icon: LucideIcons.plus,
                  color: Kf.green,
                  label: l.t('বাজারের লিস্টে যোগ করুন: “$words”', 'Add “$words” to the bazar list'),
                  onTap: () => _add(words),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// The fresh market banner: the bazar photo, a headline and "Order now".
class _Hero extends ConsumerWidget {
  const _Hero({required this.onOrder});

  final VoidCallback onOrder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Container(
        constraints: const BoxConstraints(minHeight: 172),
        color: Kf.greenInk,
        child: Stack(
          alignment: AlignmentDirectional.centerStart,
          children: [
            Positioned.fill(child: Image.asset(servicePhoto(ServiceId.bazar), fit: BoxFit.cover, alignment: const Alignment(0.4, -0.4), excludeFromSemantics: true)),
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: [Color.lerp(Kf.greenInk, Kf.navy, 0.06)!, Kf.greenInk.withValues(alpha: 0.7), Kf.greenInk.withValues(alpha: 0)], stops: const [0, 0.55, 1]),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(18),
              child: FractionallySizedBox(
                widthFactor: 0.7,
                alignment: Alignment.centerLeft,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Semantics(
                      header: true,
                      child: Text(l.t('তাজা বাজার সরাসরি আপনার বাসায়', 'Fresh groceries, straight to your door'), style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w700, color: Colors.white, height: 1.3)),
                    ),
                    const SizedBox(height: 6),
                    Text(l.text(serviceBlurb(ServiceId.bazar)), maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: Colors.white.withValues(alpha: 0.88), height: 1.45)),
                    const SizedBox(height: 12),
                    Material(
                      color: Kf.surface,
                      borderRadius: BorderRadius.circular(999),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(999),
                        onTap: onOrder,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(l.t('এখনই অর্ডার করুন', 'Order now'), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Kf.greenInk)),
                              const SizedBox(width: 6),
                              const Icon(LucideIcons.arrowRight, size: 15, color: Kf.greenInk),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A category: its photo, with the name on the category's tint below it.
class _CategoryTile extends StatelessWidget {
  const _CategoryTile({required this.photo, required this.label, required this.tone, required this.onTap});

  final String photo;
  final String label;
  final ServiceTone tone;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: tone.soft,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: tone.line)),
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: Image.asset(_categoryPhoto(photo), fit: BoxFit.cover, cacheWidth: 400, excludeFromSemantics: true)),
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 7, 6, 8),
              child: Text(label, textAlign: TextAlign.center, maxLines: 2, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: tone.ink, height: 1.2)),
            ),
          ],
        ),
      ),
    );
  }
}

class _ServiceTile extends ConsumerWidget {
  const _ServiceTile({required this.service, required this.charge, required this.onTap});

  final ServiceId service;
  final String charge;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    final tone = ServiceTone.of(service);
    return Material(
      color: Kf.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: const BorderSide(color: Kf.line)),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.asset(servicePhoto(service), width: 48, height: 48, fit: BoxFit.cover, cacheWidth: 144, excludeFromSemantics: true),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l.text(service.label), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Kf.navy, height: 1.25)),
                    const SizedBox(height: 2),
                    Text(charge, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: tone.ink)),
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
