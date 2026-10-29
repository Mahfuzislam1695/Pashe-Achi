import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/data.dart';
import '../../core/domain.dart';
import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/messages.dart';
import '../../core/pricing.dart';
import '../../core/session.dart';
import '../../core/validation.dart';
import '../../ui/address_field.dart';
import '../../ui/banners.dart';
import '../../ui/forms.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../shell/main_shell.dart';
import 'drafts.dart';
import 'service_frame.dart';

/// কাঁচা বাজার (the website's features/bazar.tsx): the customer writes the list (Home's categories
/// and search add rows to it); staff price it and the customer confirms the bill.
class BazarScreen extends ConsumerStatefulWidget {
  const BazarScreen({super.key});

  @override
  ConsumerState<BazarScreen> createState() => _BazarScreenState();
}

class _BazarScreenState extends ConsumerState<BazarScreen> {
  bool _showError = false;
  String? _serverError;
  bool _busy = false;

  void _update(BazarDraft draft) {
    ref.read(bazarDraftProvider.notifier).set(draft);
    if (_serverError != null) setState(() => _serverError = null);
  }

  String? _check(BazarDraft d) => validateBazar(place: d.place, contactMobile: d.mobile, schedule: d.schedule, rows: d.rows);

  Future<void> _send() async {
    final draft = ref.read(bazarDraftProvider);
    if (_check(draft) != null) return setState(() => _showError = true);
    setState(() {
      _busy = true;
      _serverError = null;
    });
    try {
      await ref
          .read(apiProvider)
          .createBazar(
            place: draft.place!,
            contactMobile: normalizeMobile(draft.mobile),
            schedule: draft.schedule,
            items: [
              for (final row in draft.rows.where(isRowStarted))
                {
                  'name': row['name']!.trim(),
                  'quantity': row['quantity']!.trim(),
                  if ((row['variety'] ?? '').trim().isNotEmpty) 'variety': row['variety']!.trim(),
                },
            ],
          );
      // A fresh list; the mobile number stays.
      final notifier = ref.read(bazarDraftProvider.notifier);
      notifier.set(notifier.fresh().copyWith(mobile: draft.mobile));
      _showError = false;
      if (mounted) await afterOrderPlaced(context, ref);
    } catch (error) {
      if (mounted) setState(() => _serverError = sendErrorCode(error, formErrorPriority['bazar']!));
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
    final offers = ref.watch(offersProvider).value ?? const [];
    final draft = ref.watch(bazarDraftProvider);
    final bill = calcBazar(catalog.pricing, const []);
    final code = _serverError ?? (_showError ? _check(draft) : null);

    return ServiceFrame(
      children: [
        PromoSlider(
          offers: offers,
          pricing: catalog.pricing,
          current: ServiceId.bazar,
          onOpenOffers: () => context.push('/offers'),
          onOpenService: (service) => StatefulNavigationShell.of(context).goBranch(branchOf(service)),
        ),
        const SizedBox(height: 16),
        CustomerInfo(customer: customer),
        const SizedBox(height: 12),
        DeliveryHoursNote(service: ServiceId.bazar, windows: catalog.deliveryHours[ServiceId.bazar]!),
        const SizedBox(height: 16),
        AddressField(label: l.t('পার্সেল ডেলিভারি ঠিকানা', 'Parcel delivery address'), value: draft.place, onChanged: (place) => _update(draft.copyWith(place: place))),
        const SizedBox(height: 14),
        LabeledField(
          label: l.t('পার্সেল গ্রহীতার মোবাইল', "Parcel receiver's mobile"),
          child: DraftTextField(
            value: draft.mobile,
            onChanged: (value) => _update(draft.copyWith(mobile: value)),
            hint: '01XXXXXXXXX',
            keyboardType: TextInputType.phone,
            maxLength: 16,
            autofillHints: const [AutofillHints.telephoneNumber],
          ),
        ),
        const SizedBox(height: 14),
        ScheduleField(value: draft.schedule, onChanged: (schedule) => _update(draft.copyWith(schedule: schedule))),
        const SizedBox(height: 18),
        LineTable(
          tone: ServiceTone.of(ServiceId.bazar),
          columns: [
            LineColumn('name', l.t('কাঁচা বাজারের লিস্ট লিখুন', 'Bazar list item'), hint: l.t('আলু', 'Potatoes'), flex: 17),
            LineColumn('quantity', l.t('পরিমাণ', 'Quantity'), hint: l.t('1 কেজি', '1 kg'), flex: 9),
            LineColumn('variety', l.t('জাত বা ধরণ', 'Variety / type'), hint: l.t('দেশি', 'Local'), flex: 9, optional: true),
          ],
          priceLabel: l.t('দর', 'Price'),
          rows: draft.rows,
          onChanged: (rows) => _update(draft.copyWith(rows: rows)),
          addLabel: l.t('আরো যোগ করতে ক্লিক করুন', 'Click to add more'),
        ),
        const SizedBox(height: 20),
        BillSummary(
          lines: [
            BillLine(l.t('সর্বমোট বাজারের দাম', 'Total bazar cost'), pending: l.t('পরে জানানো হবে', 'We will send it')),
            BillLine(l.t('বাজার ক্রয় বাবদ মজুরী', 'Shopping fee'), amount: bill.serviceFee),
            BillLine(l.t('ডেলিভারী খরচ', 'Delivery charge'), amount: bill.deliveryFee),
          ],
          totalLabel: l.t('Total Bill', 'Total bill'),
          total: l.t('${l.taka(bill.total)} + বাজারের দাম', '${l.taka(bill.total)} + goods'),
        ),
        const SizedBox(height: 14),
        const QuoteNotice(ServiceId.bazar),
        const SizedBox(height: 16),
        SendOrderButton(code: code, busy: _busy, onPressed: _send),
      ],
    );
  }
}
