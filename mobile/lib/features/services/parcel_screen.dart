import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/data.dart';
import '../../core/domain.dart';
import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/messages.dart';
import '../../core/session.dart';
import '../../core/validation.dart';
import '../../ui/address_field.dart';
import '../../ui/banners.dart';
import '../../ui/forms.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import 'drafts.dart';
import 'service_frame.dart';

/// পণ্য আদান প্রদান (the website's features/parcel.tsx): priced from the Catalog at once, so there
/// is no quote to wait for. Labels sit above their boxes here (the sketch put them beside, which is
/// too narrow on a phone).
class ParcelScreen extends ConsumerStatefulWidget {
  const ParcelScreen({super.key});

  @override
  ConsumerState<ParcelScreen> createState() => _ParcelScreenState();
}

class _ParcelScreenState extends ConsumerState<ParcelScreen> {
  bool _showError = false;
  String? _serverError;
  bool _busy = false;

  void _update(ParcelDraft draft) {
    ref.read(parcelDraftProvider.notifier).set(draft);
    if (_serverError != null) setState(() => _serverError = null);
  }

  String? _check(ParcelDraft d) =>
      validateParcel(product: d.product, weight: d.weight, pickup: d.pickup, dropoff: d.dropoff, receiverMobile: d.receiverMobile, schedule: d.schedule);

  Future<void> _send() async {
    final draft = ref.read(parcelDraftProvider);
    if (_check(draft) != null) return setState(() => _showError = true);
    setState(() {
      _busy = true;
      _serverError = null;
    });
    try {
      await ref
          .read(apiProvider)
          .createParcel(
            product: draft.product.trim(),
            weight: draft.weight.trim().isEmpty ? null : draft.weight.trim(),
            pickup: draft.pickup!,
            dropoff: draft.dropoff!,
            receiverMobile: normalizeMobile(draft.receiverMobile),
            schedule: draft.schedule,
          );
      final notifier = ref.read(parcelDraftProvider.notifier);
      notifier.set(notifier.fresh());
      _showError = false;
      if (mounted) await afterOrderPlaced(context, ref);
    } catch (error) {
      if (mounted) setState(() => _serverError = sendErrorCode(error, formErrorPriority['parcel']!));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = ref.watch(l10nProvider);
    final customer = ref.watch(customerProvider);
    final catalog = ref.watch(catalogProvider).value;
    if (customer == null || catalog == null) return const SizedBox.shrink();
    final draft = ref.watch(parcelDraftProvider);
    final code = _serverError ?? (_showError ? _check(draft) : null);

    return ServiceFrame(
      children: [
        ServiceBanner(service: ServiceId.parcel, pricing: catalog.pricing),
        const SizedBox(height: 16),
        CustomerInfo(customer: customer),
        const SizedBox(height: 12),
        DeliveryHoursNote(service: ServiceId.parcel, windows: catalog.deliveryHours[ServiceId.parcel]!),
        const SizedBox(height: 16),
        LabeledField(
          label: l.t('পণ্যের নাম', 'Product name'),
          child: DraftTextField(value: draft.product, onChanged: (v) => _update(draft.copyWith(product: v)), hint: l.t('যেমন: কাপড়ের ব্যাগ', 'e.g. Bag of clothes'), maxLength: 160),
        ),
        const SizedBox(height: 14),
        LabeledField(
          label: l.t('পণ্যের ওজন', 'Product weight'),
          child: DraftTextField(value: draft.weight, onChanged: (v) => _update(draft.copyWith(weight: v)), hint: l.t('যেমন: ২ কেজি', 'e.g. 2 kg'), maxLength: 40),
        ),
        const SizedBox(height: 14),
        AddressField(label: l.t('গ্রহণের ঠিকানা', 'Pickup address'), value: draft.pickup, onChanged: (place) => _update(draft.copyWith(pickup: place))),
        const SizedBox(height: 14),
        AddressField(label: l.t('পৌঁছানোর ঠিকানা', 'Delivery address'), value: draft.dropoff, onChanged: (place) => _update(draft.copyWith(dropoff: place))),
        const SizedBox(height: 14),
        LabeledField(
          label: l.t('গ্রহীতার মোবা', "Receiver's mobile"),
          child: DraftTextField(
            value: draft.receiverMobile,
            onChanged: (v) => _update(draft.copyWith(receiverMobile: v)),
            hint: '01XXXXXXXXX',
            keyboardType: TextInputType.phone,
            maxLength: 16,
          ),
        ),
        const SizedBox(height: 14),
        ScheduleField(value: draft.schedule, onChanged: (schedule) => _update(draft.copyWith(schedule: schedule))),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(color: Kf.violetTint, borderRadius: BorderRadius.circular(Kf.radiusControl), border: Border.all(color: Kf.violetLine)),
          child: Row(
            children: [
              Expanded(child: Text(l.t('ডেলিভারী খরচ', 'Delivery charge'), style: const TextStyle(fontWeight: FontWeight.w700, color: Kf.violetInk))),
              Text(l.taka(catalog.pricing.parcelDeliveryFee), style: const TextStyle(fontWeight: FontWeight.w700, color: Kf.navy, fontSize: 15)),
            ],
          ),
        ),
        const SizedBox(height: 16),
        SendOrderButton(code: code, busy: _busy, onPressed: _send, label: l.t('অর্ডার নিশ্চিত করুন', 'Confirm order')),
      ],
    );
  }
}
