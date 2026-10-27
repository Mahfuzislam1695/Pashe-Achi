import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:material_ui/material_ui.dart';

import '../../ui/lucide.dart';
import '../../core/api.dart';
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
import 'drafts.dart';
import 'service_frame.dart';

/// The server's limit for a prescription.
const _maxUploadBytes = 5 * 1024 * 1024;

enum _Source { camera, photos, pdf }

/// জরুরী ঔষুধ (the website's features/medicine.tsx): a prescription, a list of medicines, or both.
class MedicineScreen extends ConsumerStatefulWidget {
  const MedicineScreen({super.key});

  @override
  ConsumerState<MedicineScreen> createState() => _MedicineScreenState();
}

class _MedicineScreenState extends ConsumerState<MedicineScreen> {
  bool _showError = false;
  String? _serverError;
  bool _busy = false;
  bool _uploading = false;
  double _progress = 0;
  String? _uploadError;

  void _update(MedicineDraft draft) {
    ref.read(medicineDraftProvider.notifier).set(draft);
    if (_serverError != null) setState(() => _serverError = null);
  }

  String? _check(MedicineDraft d) => validateMedicine(place: d.place, contactMobile: d.mobile, schedule: d.schedule, hasPrescription: d.prescription != null, rows: d.rows);

  Future<void> _choose() async {
    final l = ref.read(l10nProvider);
    final source = await showModalBottomSheet<_Source>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(leading: const Icon(LucideIcons.camera), title: Text(l.t('ছবি তুলুন', 'Take a photo')), onTap: () => Navigator.of(context).pop(_Source.camera)),
            ListTile(leading: const Icon(LucideIcons.image), title: Text(l.t('গ্যালারি থেকে ছবি', 'Choose a photo')), onTap: () => Navigator.of(context).pop(_Source.photos)),
            ListTile(leading: const Icon(LucideIcons.fileText), title: Text(l.t('PDF ফাইল', 'Choose a PDF')), onTap: () => Navigator.of(context).pop(_Source.pdf)),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (source == null) return;

    Uint8List bytes;
    String name;
    try {
      if (source == _Source.pdf) {
        final file = await FilePicker.pickFile(type: FileType.custom, allowedExtensions: const ['pdf']);
        if (file == null) return;
        bytes = await file.xFile.readAsBytes();
        name = file.name;
      } else {
        // The system photo picker or camera: no storage permission. Large photos are scaled down.
        final photo = await ImagePicker().pickImage(
          source: source == _Source.camera ? ImageSource.camera : ImageSource.gallery,
          maxWidth: 2400,
          maxHeight: 2400,
          imageQuality: 85,
        );
        if (photo == null) return;
        bytes = await photo.readAsBytes();
        name = photo.name;
      }
    } catch (_) {
      return setState(() => _uploadError = 'upload.type');
    }
    if (bytes.length > _maxUploadBytes) return setState(() => _uploadError = 'upload.size');

    setState(() {
      _uploading = true;
      _progress = 0;
      _uploadError = null;
    });
    try {
      final upload = await ref
          .read(apiProvider)
          .uploadPrescription(
            bytes,
            name,
            onProgress: (sent, total) {
              if (total > 0 && mounted) setState(() => _progress = sent / total);
            },
          );
      _update(ref.read(medicineDraftProvider).copyWith(prescription: upload));
    } catch (error) {
      if (mounted) setState(() => _uploadError = errorCode(error));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _send() async {
    if (_uploading) return;
    final draft = ref.read(medicineDraftProvider);
    if (_check(draft) != null) return setState(() => _showError = true);
    setState(() {
      _busy = true;
      _serverError = null;
    });
    try {
      await ref
          .read(apiProvider)
          .createMedicine(
            place: draft.place!,
            contactMobile: normalizeMobile(draft.mobile),
            schedule: draft.schedule,
            prescriptionUploadId: draft.prescription?.id,
            items: [
              for (final row in draft.rows.where(isRowStarted))
                {
                  'name': row['name']!.trim(),
                  'quantity': row['quantity']!.trim(),
                  'company': row['company']!.trim(),
                  'category': row['category']!.trim(),
                },
            ],
          );
      final notifier = ref.read(medicineDraftProvider.notifier);
      notifier.set(notifier.fresh().copyWith(mobile: draft.mobile));
      _showError = false;
      if (mounted) await afterOrderPlaced(context, ref);
    } catch (error) {
      if (mounted) setState(() => _serverError = sendErrorCode(error, formErrorPriority['medicine']!));
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
    final draft = ref.watch(medicineDraftProvider);
    final bill = calcMedicine(catalog.pricing, const []);
    final code = _serverError ?? (_showError ? _check(draft) : null);
    final prescription = draft.prescription;

    return ServiceFrame(
      children: [
        ServiceBanner(service: ServiceId.medicine, pricing: catalog.pricing),
        const SizedBox(height: 16),
        CustomerInfo(customer: customer),
        const SizedBox(height: 12),
        DeliveryHoursNote(service: ServiceId.medicine, windows: catalog.deliveryHours[ServiceId.medicine]!),
        const SizedBox(height: 16),
        AddressField(label: l.t('গ্রহীতার ঠিকানা', "Receiver's address"), value: draft.place, onChanged: (place) => _update(draft.copyWith(place: place))),
        const SizedBox(height: 14),
        LabeledField(
          label: l.t('গ্রহীতার মোবা', "Receiver's mobile"),
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
        const SizedBox(height: 16),
        Semantics(
          button: true,
          label: l.t('প্রেসক্রিপশন এড করুন', 'Add prescription'),
          child: Material(
            color: Kf.blueTint,
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: _uploading ? null : _choose,
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: Kf.blueLine)),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(color: Kf.surface, borderRadius: BorderRadius.circular(12)),
                      child: Icon(prescription == null ? LucideIcons.upload : LucideIcons.fileText, size: 18, color: Kf.blue),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(l.t('* প্রেসক্রিপশন এড করুন', '* Add prescription'), style: const TextStyle(fontWeight: FontWeight.w700, color: Kf.navy)),
                          const SizedBox(height: 2),
                          Text(
                            _uploading
                                ? l.t('আপলোড হচ্ছে… ${l.digits((_progress * 100).round())}%', 'Uploading… ${(_progress * 100).round()}%')
                                : prescription?.originalName ?? l.t('ছবি বা PDF', 'Photo or PDF'),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 12.5, color: Kf.muted),
                          ),
                          if (_uploading) ...[const SizedBox(height: 6), LinearProgressIndicator(value: _progress, minHeight: 3, borderRadius: BorderRadius.circular(2))],
                        ],
                      ),
                    ),
                    if (prescription != null && !_uploading)
                      IconButton(
                        tooltip: l.t('প্রেসক্রিপশন সরান', 'Remove the prescription'),
                        icon: const Icon(LucideIcons.x, size: 18),
                        onPressed: () => _update(draft.copyWith(clearPrescription: true)),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
        if (_uploadError != null) ...[const SizedBox(height: 8), FormErrorBox(code: _uploadError)],
        const SizedBox(height: 18),
        LineTable(
          tone: ServiceTone.of(ServiceId.medicine),
          columns: [
            LineColumn('name', l.t('ঔষুধের নাম লিখুন', 'Medicine name'), hint: 'Napa', flex: 12),
            LineColumn('quantity', l.t('পরিমাণ', 'Quantity'), hint: l.t('1 পাতা', '1 strip'), flex: 8),
            LineColumn('company', l.t('কোম্পানীর নাম', 'Company'), hint: 'Beximco', flex: 10),
            LineColumn('category', l.t('ক্যাটাগরি', 'Category'), hint: l.t('জ্বর', 'Fever'), flex: 9),
          ],
          priceLabel: l.t('মূল্য', 'Price'),
          rows: draft.rows,
          onChanged: (rows) => _update(draft.copyWith(rows: rows)),
          addLabel: l.t('আরো এড করুন', 'Add more'),
        ),
        const SizedBox(height: 20),
        BillSummary(
          lines: [
            BillLine(l.t('ঔষুধ মূল্য', 'Medicine cost'), pending: l.t('পরে জানানো হবে', 'We will send it')),
            BillLine(l.t('ডেলিভারী চার্জ', 'Delivery charge'), amount: bill.deliveryFee),
          ],
          totalLabel: 'Total',
          total: l.t('${l.taka(bill.total)} + ঔষুধের দাম', '${l.taka(bill.total)} + medicine'),
        ),
        const SizedBox(height: 14),
        const QuoteNotice(ServiceId.medicine),
        const SizedBox(height: 16),
        SendOrderButton(code: code, busy: _busy || _uploading, onPressed: _send),
      ],
    );
  }
}
