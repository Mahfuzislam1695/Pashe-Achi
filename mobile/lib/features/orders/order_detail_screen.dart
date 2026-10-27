import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:share_plus/share_plus.dart';

import '../../ui/lucide.dart';
import '../../core/api.dart';
import '../../core/data.dart';
import '../../core/domain.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/notifications.dart';
import '../../core/session.dart' show apiProvider;
import '../../ui/forms.dart';
import '../../ui/page.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

/// One order (the website's OrderDetailScreen): its status, the price to confirm when staff sent
/// one, the details, the lines, the bill and the timeline. The socket refreshes it on every change.
class OrderDetailScreen extends ConsumerStatefulWidget {
  const OrderDetailScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends ConsumerState<OrderDetailScreen> {
  /// The quote version on screen when the page opened: a newer one is flagged as just arrived.
  int? _seenVersion;
  String? _error;
  bool _confirming = false;
  bool _cancelling = false;

  Future<void> _confirm(OrderDetail order) async {
    HapticFeedback.mediumImpact();
    setState(() {
      _confirming = true;
      _error = null;
    });
    try {
      await ref.read(apiProvider).confirmOrder(order.id, total: order.total, quoteVersion: order.quoteVersion);
      _refresh();
      if (mounted) {
        final l = ref.read(l10nProvider);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l.t('অর্ডার কনফার্ম হয়েছে।', 'Order confirmed.'))));
      }
    } catch (error) {
      // A new price came in meanwhile: show it, with its own banner.
      if (error is ApiError && error.code == 'order.quote_changed') _refresh();
      if (mounted) setState(() => _error = errorCode(error));
    } finally {
      if (mounted) setState(() => _confirming = false);
    }
  }

  Future<void> _cancel(OrderDetail order) async {
    final l = ref.read(l10nProvider);
    final yes = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l.t('অর্ডারটি বাতিল করবেন?', 'Cancel this order?')),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: Text(l.t('না', 'No'))),
          TextButton(
            style: TextButton.styleFrom(foregroundColor: Kf.dangerInk),
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l.t('বাতিল করুন', 'Cancel order')),
          ),
        ],
      ),
    );
    if (yes != true) return;
    setState(() {
      _cancelling = true;
      _error = null;
    });
    try {
      await ref.read(apiProvider).cancelOrder(order.id);
      _refresh();
    } catch (error) {
      if (mounted) setState(() => _error = errorCode(error));
    } finally {
      if (mounted) setState(() => _cancelling = false);
    }
  }

  void _refresh() {
    ref.invalidate(orderProvider(widget.id));
    ref.invalidate(ordersProvider);
  }

  @override
  Widget build(BuildContext context) {
    final l = ref.watch(l10nProvider);
    final order = ref.watch(orderProvider(widget.id));
    final value = order.value;
    if (value != null) _seenVersion ??= value.quoteVersion;
    // A new quote clears an earlier confirm error.
    ref.listen(orderProvider(widget.id), (previous, next) {
      if (previous?.value?.quoteVersion != next.value?.quoteVersion && _error != null) setState(() => _error = null);
    });

    return PageScaffold(
      title: value?.code ?? l.t('অর্ডার', 'Order'),
      subtitle: value == null ? null : l.text(value.service.label),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(orderProvider(widget.id).future).then((_) {}, onError: (_) {}),
        child: ListView(
          padding: pagePadding(context),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            if (value != null)
              ..._content(l, value)
            else if (order.hasError)
              ErrorRetry(code: errorCode(order.error!), onRetry: () => ref.invalidate(orderProvider(widget.id)))
            else
              const LoadingNote(),
          ],
        ),
      ),
    );
  }

  List<Widget> _content(L10n l, OrderDetail order) {
    final awaiting = isAwaitingPrice(order.service, order.status);
    final fresh = order.canConfirm && order.quoteVersion > (_seenVersion ?? order.quoteVersion);
    const gap = SizedBox(height: 14);
    return [
      Row(
        children: [
          StatusPill(order.status),
          const SizedBox(width: 10),
          Expanded(child: Text(l.formatDate(order.createdAt, withTime: true), style: const TextStyle(fontSize: 12.5, color: Kf.muted))),
        ],
      ),
      gap,
      if (awaiting) ...[
        NoteBox(
          icon: LucideIcons.info,
          text: order.service == ServiceId.shifting
              ? l.t(
                  'আমরা দূরত্ব দেখে গাড়ী ভাড়া ঠিক করছি। ভাড়া জানালেই নোটিফিকেশন পাবেন, তারপর অর্ডারটি কনফার্ম বা বাতিল করতে পারবেন।',
                  'We are pricing the vehicle by distance. You will get a notification with the bill, then you can confirm or cancel the order.',
                )
              : l.t(
                  'আমরা দাম যাচাই করছি। দাম জানালেই নোটিফিকেশন পাবেন, তারপর অর্ডারটি কনফার্ম বা বাতিল করতে পারবেন।',
                  'We are checking the prices. You will get a notification with the bill, then you can confirm or cancel the order.',
                ),
        ),
        const SizedBox(height: 10),
      ],
      if (awaiting || order.canConfirm) ...[const _PushPrompt(), gap],
      if (order.canConfirm) ...[_priceCard(l, order, fresh), gap],
      SectionCard(child: _details(l, order)),
      if (order.items.isNotEmpty) ...[gap, SectionCard(child: _items(l, order))],
      if (order.prescription != null) ...[gap, _PrescriptionButton(upload: order.prescription!)],
      if (!order.canConfirm) ...[gap, SectionCard(child: _bill(l, order, awaiting))],
      gap,
      SectionCard(child: _timeline(l, order)),
      if (order.canCancel && !order.canConfirm) ...[
        gap,
        if (_error != null) ...[FormErrorBox(code: _error), const SizedBox(height: 10)],
        SecondaryButton(label: l.t('অর্ডার বাতিল করুন', 'Cancel order'), icon: LucideIcons.x, danger: true, expand: true, busy: _cancelling, onPressed: () => _cancel(order)),
      ],
    ];
  }

  List<BillLine> _lines(L10n l, OrderDetail order, {required bool awaiting}) {
    final goods = awaiting ? BillLine('', pending: l.t('দাম আসছে', 'Price coming')) : BillLine('', amount: order.itemsTotal);
    BillLine named(BillLine line, String label) => BillLine(label, amount: line.amount, pending: line.pending);
    return switch (order.service) {
      ServiceId.bazar => [
        named(goods, l.t('সর্বমোট বাজারের দাম', 'Total bazar cost')),
        BillLine(l.t('বাজার ক্রয় বাবদ মজুরী', 'Shopping fee'), amount: order.serviceFee),
        BillLine(l.t('ডেলিভারী খরচ', 'Delivery charge'), amount: order.deliveryFee),
      ],
      ServiceId.medicine => [named(goods, l.t('ঔষুধ মূল্য', 'Medicine cost')), BillLine(l.t('ডেলিভারী চার্জ', 'Delivery charge'), amount: order.deliveryFee)],
      ServiceId.shifting => [named(goods, l.t('গাড়ী ভাড়া', 'Vehicle rent')), BillLine(l.t('লেবার ও ফ্লোর', 'Labour and floors'), amount: order.serviceFee)],
      ServiceId.parcel => [BillLine(l.t('ডেলিভারী খরচ', 'Delivery charge'), amount: order.deliveryFee)],
    };
  }

  Widget _bill(L10n l, OrderDetail order, bool awaiting) {
    final total = !awaiting
        ? l.taka(order.total)
        : order.service == ServiceId.shifting
        ? l.t('${l.taka(order.total)} + গাড়ী ভাড়া', '${l.taka(order.total)} + vehicle rent')
        : l.t('${l.taka(order.total)} + পণ্যের দাম', '${l.taka(order.total)} + goods');
    return BillSummary(lines: _lines(l, order, awaiting: awaiting), totalLabel: l.t('Total Bill', 'Total bill'), total: total);
  }

  /// The price staff sent: the whole bill, their note, Confirm and Cancel.
  Widget _priceCard(L10n l, OrderDetail order, bool fresh) {
    final note = order.quoteNote;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Kf.orangeSoft, borderRadius: BorderRadius.circular(16), border: Border.all(color: Kf.orangeLine)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(header: true, child: Text(l.t('দাম জানানো হয়েছে', 'Your price is ready'), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Kf.navy))),
          if (fresh) ...[
            const SizedBox(height: 10),
            Semantics(
              liveRegion: true,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                decoration: BoxDecoration(color: Kf.blue, borderRadius: BorderRadius.circular(12)),
                child: Text(
                  _seenVersion == 0
                      ? l.t('দাম এসে গেছে! দেখে কনফার্ম করুন।', 'Your price just arrived. Check it, then confirm.')
                      : l.t('নতুন দাম এসেছে। বদলানো বিল দেখে কনফার্ম করুন।', 'A new price just arrived. Check the updated bill, then confirm.'),
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13),
                ),
              ),
            ),
          ],
          const SizedBox(height: 8),
          Text(
            l.t(
              'নিচের বিল দেখে অর্ডারটি কনফার্ম করুন, অথবা বাতিল করুন। কনফার্ম করার পর দাম আর বদলাবে না।',
              'Check the bill below, then confirm or cancel. Once you confirm, the price will not change.',
            ),
            style: const TextStyle(fontSize: 13, color: Kf.ink2, height: 1.55),
          ),
          if (note != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: Kf.surface, borderRadius: BorderRadius.circular(10)),
              child: Text(note, style: const TextStyle(fontSize: 13, color: Kf.ink, height: 1.5)),
            ),
          ],
          const SizedBox(height: 12),
          BillSummary(lines: _lines(l, order, awaiting: false), withCurrency: l.taka, totalLabel: l.t('মোট বিল', 'Total bill'), total: l.taka(order.total)),
          if (_error != null) ...[const SizedBox(height: 12), FormErrorBox(code: _error)],
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                flex: 14,
                child: PrimaryButton(
                  label: _confirming ? l.t('অপেক্ষা করুন…', 'Please wait…') : l.t('কনফার্ম করুন', 'Confirm'),
                  icon: LucideIcons.check,
                  busy: _confirming,
                  onPressed: _cancelling ? null : () => _confirm(order),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 10,
                child: SecondaryButton(
                  label: l.t('বাতিল করুন', 'Cancel'),
                  icon: LucideIcons.x,
                  danger: true,
                  busy: _cancelling,
                  onPressed: _confirming ? null : () => _cancel(order),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _details(L10n l, OrderDetail order) {
    final rows = <Widget>[];
    void add(String label, String value, {GeoPoint? pin}) => rows.add(_DetailRow(label: label, value: value, pin: pin));
    add(order.service == ServiceId.shifting ? l.t('শিফটিং এর সময়', 'Shifting time') : l.t('ডেলিভারি', 'Delivery'), '${l.formatDate(order.scheduledDate)} · ${order.scheduledTime}');
    if (order.address != null) add(l.t('ঠিকানা', 'Address'), order.address!, pin: order.addressPin);
    if (order.contactMobile.isNotEmpty) add(l.t('মোবা', 'Mobile'), order.contactMobile);
    final shifting = order.shifting;
    if (shifting != null) {
      add('Loading Area', shifting.loadingArea, pin: shifting.loadingPin);
      add('Unloading Area', shifting.unloadingArea, pin: shifting.unloadingPin);
      add(l.t('গাড়ী', 'Vehicle'), '${l.text(shifting.vehicleName)}${shifting.vehicleRate != null ? ' · ${l.taka(shifting.vehicleRate!)}' : ''}');
      add(l.t('লেবার', 'Labourers'), '${shifting.labourers}');
      add(l.t('ফ্লোর', 'Floors'), '${shifting.loadingFloor} → ${shifting.unloadingFloor}');
    }
    final parcel = order.parcel;
    if (parcel != null) {
      add(l.t('পণ্য', 'Product'), '${parcel.product}${parcel.weight != null ? ' · ${parcel.weight}' : ''}');
      add(l.t('গ্রহণ', 'Pickup'), parcel.pickupAddress, pin: parcel.pickupPin);
      add(l.t('পৌঁছানো', 'Drop-off'), parcel.dropoffAddress, pin: parcel.dropoffPin);
      add(l.t('গ্রহীতা', 'Receiver'), parcel.receiverMobile);
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: rows);
  }

  Widget _items(L10n l, OrderDetail order) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < order.items.length; i++) ...[
          if (i > 0) const Divider(height: 18),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${l.rowNumber(i)} ${order.items[i].name}', style: const TextStyle(fontWeight: FontWeight.w600, color: Kf.ink)),
                    Text(
                      [order.items[i].quantity, order.items[i].variety, order.items[i].company, order.items[i].category].whereType<String>().where((s) => s.isNotEmpty).join(' · '),
                      style: const TextStyle(fontSize: 12, color: Kf.muted),
                    ),
                  ],
                ),
              ),
              Text(order.items[i].price == null ? '—' : '${order.items[i].price}', style: const TextStyle(fontWeight: FontWeight.w600, color: Kf.navy)),
            ],
          ),
        ],
      ],
    );
  }

  Widget _timeline(L10n l, OrderDetail order) {
    Color dot(OrderStatus status) => switch (status) {
      OrderStatus.pending => Kf.warnInk,
      OrderStatus.inProgress => Kf.violet,
      OrderStatus.completed => Kf.green,
      OrderStatus.cancelled => Kf.danger,
      _ => Kf.blue,
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < order.events.length; i++)
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  width: 18,
                  child: Column(
                    children: [
                      const SizedBox(height: 5),
                      Container(width: 10, height: 10, decoration: BoxDecoration(color: dot(order.events[i].to), shape: BoxShape.circle)),
                      if (i < order.events.length - 1) Expanded(child: Container(width: 2, color: Kf.line)),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        StatusPill(order.events[i].to),
                        if (order.events[i].note != null) ...[const SizedBox(height: 4), Text(order.events[i].note!, style: const TextStyle(fontSize: 13, color: Kf.ink2))],
                        const SizedBox(height: 3),
                        Text(l.formatDate(order.events[i].createdAt, withTime: true), style: const TextStyle(fontSize: 12, color: Kf.muted)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _DetailRow extends ConsumerWidget {
  const _DetailRow({required this.label, required this.value, this.pin});

  final String label;
  final String value;
  final GeoPoint? pin;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 104, child: Text(label, style: const TextStyle(fontSize: 12.5, color: Kf.muted))),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value.isEmpty ? '—' : value, style: const TextStyle(fontSize: 13.5, color: Kf.ink, height: 1.45)),
                if (pin != null)
                  InkWell(
                    onTap: () => openLink(pin!.mapLink),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(LucideIcons.mapPin, size: 13, color: Kf.blue),
                          const SizedBox(width: 4),
                          Text(l.t('ম্যাপ', 'Map'), style: const TextStyle(fontSize: 12.5, color: Kf.blue, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// "Turn on phone notifications to hear the moment your price is ready", while a price is on its way.
class _PushPrompt extends ConsumerWidget {
  const _PushPrompt();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    final status = ref.watch(pushStatusProvider).value;
    if (status == null || status == PushStatus.on) return const SizedBox.shrink();
    final push = ref.read(pushProvider);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Kf.blueTint, borderRadius: BorderRadius.circular(14), border: Border.all(color: Kf.blueLine)),
      child: Row(
        children: [
          const Icon(LucideIcons.bellRing, size: 18, color: Kf.blue),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              l.t('দাম জানালেই ফোনে নোটিফিকেশন পেতে চালু করুন।', 'Turn on phone notifications to hear the moment your price is ready.'),
              style: const TextStyle(fontSize: 12.5, color: Kf.ink2, height: 1.5),
            ),
          ),
          const SizedBox(width: 8),
          TextButton(
            onPressed: () => status == PushStatus.blocked ? push.openSettings() : push.turnOn(),
            child: Text(status == PushStatus.blocked ? l.t('সেটিংস', 'Settings') : l.t('চালু করুন', 'Turn on')),
          ),
        ],
      ),
    );
  }
}

/// The prescription the customer uploaded: a photo opens full screen, a PDF goes to the share sheet
/// (to open in a PDF viewer). Both need the sign-in, so the bytes come through the API.
class _PrescriptionButton extends ConsumerStatefulWidget {
  const _PrescriptionButton({required this.upload});

  final UploadInfo upload;

  @override
  ConsumerState<_PrescriptionButton> createState() => _PrescriptionButtonState();
}

class _PrescriptionButtonState extends ConsumerState<_PrescriptionButton> {
  bool _loading = false;
  String? _error;

  Future<void> _open() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final bytes = await ref.read(apiProvider).prescriptionBytes(widget.upload.id);
      if (!mounted) return;
      if (widget.upload.isImage) {
        await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => _ImageViewer(bytes: bytes, title: widget.upload.originalName)));
      } else {
        await SharePlus.instance.share(ShareParams(files: [XFile.fromData(bytes, mimeType: widget.upload.mime, name: widget.upload.originalName)], fileNameOverrides: [widget.upload.originalName]));
      }
    } catch (error) {
      if (mounted) setState(() => _error = errorCode(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = ref.watch(l10nProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SecondaryButton(label: l.t('প্রেসক্রিপশন দেখুন', 'View prescription'), icon: LucideIcons.fileText, busy: _loading, expand: true, onPressed: _open),
        if (_error != null) ...[const SizedBox(height: 8), FormErrorBox(code: _error)],
      ],
    );
  }
}

class _ImageViewer extends StatelessWidget {
  const _ImageViewer({required this.bytes, required this.title});

  final Uint8List bytes;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(backgroundColor: Colors.black, foregroundColor: Colors.white, title: Text(title, style: const TextStyle(color: Colors.white, fontSize: 15)), shape: const Border()),
      body: InteractiveViewer(maxScale: 5, child: Center(child: Image.memory(bytes, fit: BoxFit.contain))),
    );
  }
}
