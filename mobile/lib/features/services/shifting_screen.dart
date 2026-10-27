import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/data.dart';
import '../../core/domain.dart';
import '../../core/i18n.dart';
import '../../core/messages.dart';
import '../../core/models.dart';
import '../../core/pricing.dart';
import '../../core/session.dart';
import '../../core/validation.dart';
import '../../ui/address_field.dart';
import '../../ui/banners.dart';
import '../../ui/forms.dart';
import '../../ui/theme.dart';
import 'drafts.dart';
import 'service_frame.dart';

/// বাসা বদল (the website's features/shifting.tsx): the two places, the day, a vehicle and the
/// labour and floors. Staff price the vehicle rent by the distance; labour and floors use the Catalog.
class ShiftingScreen extends ConsumerStatefulWidget {
  const ShiftingScreen({super.key});

  @override
  ConsumerState<ShiftingScreen> createState() => _ShiftingScreenState();
}

class _ShiftingScreenState extends ConsumerState<ShiftingScreen> {
  bool _showError = false;
  String? _serverError;
  bool _busy = false;

  void _update(ShiftingDraft draft) {
    ref.read(shiftingDraftProvider.notifier).set(draft);
    if (_serverError != null) setState(() => _serverError = null);
  }

  /// The draft's vehicle, or the first one when it is gone from the Catalog.
  Vehicle? _vehicle(ShiftingDraft draft, Catalog catalog) =>
      catalog.vehicles.where((v) => v.id == draft.vehicleId).firstOrNull ?? catalog.vehicles.firstOrNull;

  String? _check(ShiftingDraft d, Catalog catalog) => validateShifting(
    loading: d.loading,
    unloading: d.unloading,
    schedule: d.schedule,
    vehicleId: _vehicle(d, catalog)?.id,
    labourers: d.labourers,
    loadingFloor: d.loadingFloor,
    unloadingFloor: d.unloadingFloor,
  );

  Future<void> _send(Catalog catalog) async {
    final draft = ref.read(shiftingDraftProvider);
    if (_check(draft, catalog) != null) return setState(() => _showError = true);
    setState(() {
      _busy = true;
      _serverError = null;
    });
    try {
      await ref
          .read(apiProvider)
          .createShifting(
            loading: draft.loading!,
            unloading: draft.unloading!,
            schedule: draft.schedule,
            vehicleId: _vehicle(draft, catalog)!.id,
            labourers: draft.labourers,
            loadingFloor: draft.loadingFloor,
            unloadingFloor: draft.unloadingFloor,
          );
      // New places and day; the vehicle, labour and floors stay.
      final fresh = ref.read(shiftingDraftProvider.notifier).fresh();
      ref
          .read(shiftingDraftProvider.notifier)
          .set(fresh.copyWith(vehicleId: draft.vehicleId, labourers: draft.labourers, loadingFloor: draft.loadingFloor, unloadingFloor: draft.unloadingFloor));
      _showError = false;
      if (mounted) await afterOrderPlaced(context, ref);
    } catch (error) {
      if (mounted) {
        final code = sendErrorCode(error, formErrorPriority['shifting']!);
        setState(() => _serverError = code == 'schedule.required' ? 'shifting.schedule_required' : code);
      }
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
    final draft = ref.watch(shiftingDraftProvider);
    final pricing = catalog.pricing;
    final vehicle = _vehicle(draft, catalog);
    final bill = calcShifting(pricing, labourers: draft.labourers, loadingFloor: draft.loadingFloor, unloadingFloor: draft.unloadingFloor);
    final code = _serverError ?? (_showError ? _check(draft, catalog) : null);

    return ServiceFrame(
      children: [
        ServiceBanner(service: ServiceId.shifting, pricing: pricing),
        const SizedBox(height: 16),
        CustomerInfo(customer: customer, showPoints: false),
        const SizedBox(height: 12),
        DeliveryHoursNote(service: ServiceId.shifting, windows: catalog.deliveryHours[ServiceId.shifting]!),
        const SizedBox(height: 16),
        AddressField(label: l.t('Loading Area', 'Loading area'), value: draft.loading, onChanged: (place) => _update(draft.copyWith(loading: place))),
        const SizedBox(height: 14),
        AddressField(label: l.t('Unloading Area', 'Unloading area'), value: draft.unloading, onChanged: (place) => _update(draft.copyWith(unloading: place))),
        const SizedBox(height: 14),
        ScheduleField(
          value: draft.schedule,
          onChanged: (schedule) => _update(draft.copyWith(schedule: schedule)),
          dateLabel: l.t('শিফটিং এর তারিখ', 'Shifting date'),
          timeLabel: l.t('শিফটিং এর সময়', 'Shifting time'),
        ),
        const SizedBox(height: 18),
        _Step(
          number: 1,
          label: l.t('গাড়ী', 'Vehicle'),
          rateLabel: l.t('রেট', 'Rate'),
          rate: vehicle == null ? '—' : l.t('${l.taka(vehicle.rate)} থেকে', 'from ${l.taka(vehicle.rate)}'),
          control: DropdownButtonFormField<String>(
            // Rebuilt when the vehicle changes from outside (a Catalog that dropped it).
            key: ValueKey(vehicle?.id),
            initialValue: vehicle?.id,
            isExpanded: true,
            decoration: const InputDecoration(contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12)),
            items: [for (final v in catalog.vehicles) DropdownMenuItem(value: v.id, child: Text(l.text(v.name), overflow: TextOverflow.ellipsis))],
            onChanged: catalog.vehicles.isEmpty ? null : (id) => _update(draft.copyWith(vehicleId: id)),
          ),
        ),
        _Step(
          number: 2,
          label: l.t('লেবার সংখ্যা', 'Number of labourers'),
          rateLabel: l.t('জনপ্রতি মজুরী', 'Wage per person'),
          rate: l.taka(pricing.wagePerLabourer),
          control: CountStepper(value: draft.labourers, max: 50, label: l.t('লেবার সংখ্যা', 'Number of labourers'), onChanged: (n) => _update(draft.copyWith(labourers: n))),
        ),
        _Step(
          number: 3,
          label: l.t('ফ্লোর নং (loading)', 'Floor no. (loading)'),
          rateLabel: l.t('প্রতি ফ্লোর', 'Per floor'),
          rate: l.taka(pricing.loadingRatePerFloor),
          control: CountStepper(value: draft.loadingFloor, max: 60, label: l.t('ফ্লোর নং (loading)', 'Floor no. (loading)'), onChanged: (n) => _update(draft.copyWith(loadingFloor: n))),
        ),
        _Step(
          number: 4,
          label: l.t('ফ্লোর নং (unloading)', 'Floor no. (unloading)'),
          rateLabel: l.t('প্রতি ফ্লোর', 'Per floor'),
          rate: l.taka(pricing.unloadingRatePerFloor),
          control: CountStepper(value: draft.unloadingFloor, max: 60, label: l.t('ফ্লোর নং (unloading)', 'Floor no. (unloading)'), onChanged: (n) => _update(draft.copyWith(unloadingFloor: n))),
        ),
        const SizedBox(height: 8),
        BillSummary(
          lines: [
            BillLine(l.t('গাড়ী ভাড়া', 'Vehicle rent'), pending: l.t('দূরত্ব দেখে জানানো হবে', 'We will send it')),
            BillLine(l.t('লেবার ও ফ্লোর', 'Labour and floors'), amount: bill.serviceFee),
          ],
          totalLabel: 'Total cost',
          total: l.t('${l.taka(bill.total)} + গাড়ী ভাড়া', '${l.taka(bill.total)} + vehicle rent'),
        ),
        const SizedBox(height: 14),
        const QuoteNotice(ServiceId.shifting),
        const SizedBox(height: 16),
        SendOrderButton(code: code, busy: _busy, onPressed: () => _send(catalog)),
      ],
    );
  }
}

/// A numbered step: its label, the control, and the rate it is charged at.
class _Step extends ConsumerWidget {
  const _Step({required this.number, required this.label, required this.control, required this.rateLabel, required this.rate});

  final int number;
  final String label;
  final Widget control;
  final String rateLabel;
  final String rate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 22,
                height: 22,
                alignment: Alignment.center,
                decoration: const BoxDecoration(color: Kf.blue, shape: BoxShape.circle),
                child: Text(l.digits(number), style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w700)),
              ),
              const SizedBox(width: 8),
              Expanded(child: Text(label, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Kf.ink2))),
            ],
          ),
          const SizedBox(height: 7),
          Row(
            children: [
              Expanded(child: control),
              const SizedBox(width: 10),
              Container(
                width: 112,
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(color: Kf.surface2, borderRadius: BorderRadius.circular(Kf.radiusControl), border: Border.all(color: Kf.line)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(rateLabel, style: const TextStyle(fontSize: 10.5, color: Kf.muted)),
                    Text(rate, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Kf.navy)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
