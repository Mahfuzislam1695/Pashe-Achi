import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../config.dart';
import '../../core/data.dart';
import '../../core/domain.dart';
import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/banners.dart';
import '../../ui/location_sheet.dart';
import '../../ui/lucide.dart';
import '../../ui/theme.dart';
import '../offers/offers_screen.dart';
import '../services/drafts.dart';
import '../services/service_frame.dart';
import '../shell/main_shell.dart';

final _coral = ServiceTone(
  Kf.coral,
  Color.alphaBlend(Kf.coral.withValues(alpha: 0.11), Kf.surface),
  Color.lerp(Kf.coral, Kf.navy, 0.38)!,
  Color.alphaBlend(Kf.coral.withValues(alpha: 0.28), Kf.surface),
  LucideIcons.shoppingBag,
);

/// A category tile's colours, by the name staff picked.
ServiceTone _tone(String name) => switch (name) {
  'coral' => _coral,
  'green' => const ServiceTone(Kf.green, Kf.greenSoft, Kf.greenInk, Kf.greenLine, LucideIcons.shoppingBag),
  'orange' => const ServiceTone(Kf.orangeIcon, Kf.orangeSoft, Kf.orangeInk, Kf.orangeLine, LucideIcons.shoppingBag),
  'violet' => const ServiceTone(Kf.violet, Kf.violetTint, Kf.violetInk, Kf.violetLine, LucideIcons.shoppingBag),
  'neutral' => const ServiceTone(Kf.muted, Kf.surface2, Kf.ink2, Kf.line, LucideIcons.shoppingBag),
  _ => const ServiceTone(Kf.blue, Kf.blueSoft, Kf.blueInk, Kf.blueLine, LucideIcons.shoppingBag),
};

/// Home, where the app opens (the website's features/home.tsx): the customer's location and a search
/// that writes the bazar list, then what staff set on /admin/home: the banners, the bazar's categories,
/// the service pictures and each section's heading and visibility. আজকের অফার comes from the Offers page.
/// There is no product catalog: categories and searches become bazar list rows. If the content can't
/// load, the location, the search and the services still work.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    final catalog = ref.watch(catalogProvider).value;
    if (catalog == null) return const SizedBox.shrink();
    final home = ref.watch(homeProvider).value;
    final offers = ref.watch(offersProvider).value ?? const [];
    final categories = home?.categories ?? const <HomeCategory>[];
    final categorySection = home?.sections['categories'];
    final serviceSection = home?.sections['services'];
    final offerSection = home?.sections['offers'];
    final gutter = Kf.gutter(context);
    final wide = MediaQuery.sizeOf(context).width >= 600;

    void openService(ServiceId service) => StatefulNavigationShell.of(context).goBranch(branchOf(service));
    void openBazar([String? item]) {
      if (item != null) addBazarItem(ref, item);
      openService(ServiceId.bazar);
    }

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(catalogProvider);
        ref.invalidate(offersProvider);
        ref.invalidate(homeProvider);
        try {
          await ref.read(homeProvider.future);
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
                  _HomeSearch(categories: categories, onAdd: openBazar, onService: openService),
                  if (home != null && home.banners.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    HomeBanners(banners: home.banners, onOpenOffers: () => context.push('/offers'), onOpenService: openService),
                  ],
                  if (categories.isNotEmpty && categorySection != null && categorySection.visible) ...[
                    const SizedBox(height: 22),
                    _Heading(l.text(categorySection.heading)),
                    const SizedBox(height: 10),
                    GridView.count(
                      crossAxisCount: wide ? 6 : 3,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      childAspectRatio: 0.92,
                      children: [
                        for (final category in categories)
                          _CategoryTile(category: category, onTap: () => category.addsItem ? openBazar(l.text(category.name)) : openBazar()),
                      ],
                    ),
                  ],
                  if (serviceSection == null || serviceSection.visible) ...[
                    const SizedBox(height: 22),
                    _Heading(serviceSection == null ? l.t('আমাদের সেবা', 'Our services') : l.text(serviceSection.heading)),
                    const SizedBox(height: 10),
                    GridView.count(
                      crossAxisCount: wide ? 4 : 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      childAspectRatio: 1.9,
                      children: [
                        for (final service in ServiceId.values)
                          _ServiceTile(service: service, imageUrl: home?.serviceImages[service.name], charge: serviceCharge(l, catalog.pricing, service), onTap: () => openService(service)),
                      ],
                    ),
                  ],
                  if (offers.isNotEmpty && offerSection != null && offerSection.visible) ...[
                    const SizedBox(height: 22),
                    _Heading(
                      l.text(offerSection.heading),
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
  const _HomeSearch({required this.categories, required this.onAdd, required this.onService});

  final List<HomeCategory> categories;
  final void Function([String? item]) onAdd;
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

  void _add([String? item]) {
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
    final categories = widget.categories.where((category) => matches(category.name));

    Widget suggestion({required IconData icon, required Color color, required String label, required VoidCallback onTap}) => InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
        child: Row(
          children: [
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
                  suggestion(
                    icon: ServiceTone.of(service).icon,
                    color: ServiceTone.of(service).color,
                    label: l.text(service.label),
                    onTap: () {
                      FocusScope.of(context).unfocus();
                      widget.onService(service);
                    },
                  ),
                for (final category in categories)
                  suggestion(
                    icon: LucideIcons.shoppingBag,
                    color: _tone(category.tone).color,
                    label: l.text(category.name),
                    onTap: () => category.addsItem ? _add(l.text(category.name)) : _add(),
                  ),
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

/// A category: its picture, with the name on the category's tint below it. Without a picture, or
/// without a connection, the tint alone.
class _CategoryTile extends ConsumerWidget {
  const _CategoryTile({required this.category, required this.onTap});

  final HomeCategory category;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    final tone = _tone(category.tone);
    final imageUrl = category.imageUrl;
    final blank = ColoredBox(color: tone.line);
    return Material(
      color: tone.soft,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: tone.line)),
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: imageUrl == null
                  ? blank
                  : CachedNetworkImage(imageUrl: '${AppConfig.origin}$imageUrl', fit: BoxFit.cover, placeholder: (_, _) => blank, errorWidget: (_, _, _) => blank),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 7, 6, 8),
              child: Text(l.text(category.name), textAlign: TextAlign.center, maxLines: 2, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: tone.ink, height: 1.2)),
            ),
          ],
        ),
      ),
    );
  }
}

class _ServiceTile extends ConsumerWidget {
  const _ServiceTile({required this.service, required this.imageUrl, required this.charge, required this.onTap});

  final ServiceId service;

  /// The picture staff set; until it loads, or without a connection, the bundled photo.
  final String? imageUrl;
  final String charge;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    final tone = ServiceTone.of(service);
    final bundled = Image.asset(servicePhoto(service), width: 48, height: 48, fit: BoxFit.cover, cacheWidth: 144, excludeFromSemantics: true);
    final url = imageUrl;
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
                child: url == null
                    ? bundled
                    : CachedNetworkImage(imageUrl: '${AppConfig.origin}$url', width: 48, height: 48, fit: BoxFit.cover, memCacheWidth: 144, placeholder: (_, _) => bundled, errorWidget: (_, _, _) => bundled),
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
