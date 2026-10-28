import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../core/delivery_hours.dart';
import '../core/domain.dart';
import '../core/format.dart';
import '../core/i18n.dart';
import '../core/models.dart';
import '../core/validation.dart';
import 'lucide.dart';
import 'theme.dart';
import 'widgets.dart';

/// One column of a line table.
class LineColumn {
  const LineColumn(this.key, this.label, {this.hint = '', this.flex = 10, this.optional = false});

  final String key;
  final String label;
  final String hint;
  final int flex;

  /// May stay blank (bazar's variety).
  final bool optional;
}

/// The bazar and medicine lists (the website's components/line-table.tsx): one row to start, a
/// greyed price box that staff fill in, and "add more" once the last row's required boxes are filled.
class LineTable extends StatefulWidget {
  const LineTable({super.key, required this.columns, required this.rows, required this.onChanged, required this.addLabel, required this.tone, required this.priceLabel});

  final List<LineColumn> columns;
  final List<Map<String, String>> rows;
  final ValueChanged<List<Map<String, String>>> onChanged;
  final String addLabel;
  final String priceLabel;
  final ServiceTone tone;

  @override
  State<LineTable> createState() => _LineTableState();
}

class _LineTableState extends State<LineTable> {
  final _controllers = <List<TextEditingController>>[];

  @override
  void initState() {
    super.initState();
    _sync();
  }

  @override
  void didUpdateWidget(LineTable old) {
    super.didUpdateWidget(old);
    _sync();
  }

  /// Keeps one controller per box, following the draft (it resets after an order is sent).
  void _sync() {
    while (_controllers.length > widget.rows.length) {
      for (final c in _controllers.removeLast()) {
        c.dispose();
      }
    }
    for (var i = 0; i < widget.rows.length; i++) {
      if (i >= _controllers.length) {
        _controllers.add([for (final column in widget.columns) TextEditingController(text: widget.rows[i][column.key] ?? '')]);
      } else {
        for (var j = 0; j < widget.columns.length; j++) {
          final value = widget.rows[i][widget.columns[j].key] ?? '';
          if (_controllers[i][j].text != value) _controllers[i][j].text = value;
        }
      }
    }
  }

  @override
  void dispose() {
    for (final row in _controllers) {
      for (final c in row) {
        c.dispose();
      }
    }
    super.dispose();
  }

  void _edit(int row, String key, String value) {
    final rows = [for (final r in widget.rows) {...r}];
    rows[row][key] = value;
    widget.onChanged(rows);
  }

  bool get _lastComplete {
    final last = widget.rows.last;
    return widget.columns.where((c) => !c.optional).every((c) => (last[c.key] ?? '').trim().isNotEmpty);
  }

  @override
  Widget build(BuildContext context) {
    return Consumer(
      builder: (context, ref, _) {
        final l = ref.watch(l10nProvider);
        final tone = widget.tone;
        const numberWidth = 22.0;
        const priceFlex = 8;
        Widget cell(int flex, Widget child) => Expanded(flex: flex, child: Padding(padding: const EdgeInsets.symmetric(horizontal: 2), child: child));
        // Headings wrap between words; a one-word heading too wide for its column ("Quantity")
        // shrinks instead of breaking in the middle of the word.
        Widget heading(String text) {
          final label = Text(text, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: tone.ink, height: 1.25));
          return text.trim().contains(' ') ? label : FittedBox(fit: BoxFit.scaleDown, alignment: AlignmentDirectional.centerStart, child: label);
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
              decoration: BoxDecoration(color: tone.soft, borderRadius: BorderRadius.circular(10), border: Border.all(color: tone.line)),
              child: Row(
                children: [
                  const SizedBox(width: numberWidth),
                  for (final column in widget.columns) cell(column.flex, heading(column.label)),
                  cell(priceFlex, heading(widget.priceLabel)),
                ],
              ),
            ),
            for (var i = 0; i < widget.rows.length && i < _controllers.length; i++)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(
                  children: [
                    SizedBox(width: numberWidth, child: Text(l.rowNumber(i), style: const TextStyle(fontSize: 12, color: Kf.muted, fontWeight: FontWeight.w600))),
                    for (var j = 0; j < widget.columns.length; j++)
                      cell(
                        widget.columns[j].flex,
                        TextField(
                          controller: _controllers[i][j],
                          onChanged: (value) => _edit(i, widget.columns[j].key, value),
                          style: const TextStyle(fontSize: 13),
                          textInputAction: TextInputAction.next,
                          decoration: InputDecoration(
                            hintText: widget.columns[j].hint,
                            // The theme's hint is a size larger; in these narrow cells "1 কেজি" would be cut.
                            hintStyle: const TextStyle(color: Kf.muted3, fontSize: 13, letterSpacing: 0),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 7, vertical: 12),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Kf.lineStrong)),
                            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Kf.lineStrong)),
                          ),
                        ),
                      ),
                    // Staff price every line; the customer never sends prices.
                    cell(
                      priceFlex,
                      ExcludeSemantics(
                        child: Container(
                          height: 44,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: Kf.surface3, borderRadius: BorderRadius.circular(10), border: Border.all(color: Kf.line)),
                          child: const Text('৳', style: TextStyle(color: Kf.muted3)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            if (_lastComplete)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () => widget.onChanged([...widget.rows, <String, String>{}]),
                  icon: const Icon(LucideIcons.plus, size: 15),
                  label: Text(widget.addLabel),
                ),
              ),
          ],
        );
      },
    );
  }
}

/// Delivery date and time: the date from today (Bangladesh), any time of day (owner's rule).
class ScheduleField extends ConsumerWidget {
  const ScheduleField({super.key, required this.value, required this.onChanged, this.dateLabel, this.timeLabel});

  final Schedule value;
  final ValueChanged<Schedule> onChanged;
  final String? dateLabel;
  final String? timeLabel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    final localizations = MaterialLocalizations.of(context);
    final time = _parseTime(value.time);

    Widget box({required IconData icon, required String text, required bool empty, required VoidCallback onTap, required String label}) {
      return LabeledField(
        label: label,
        child: Semantics(
          button: true,
          label: '$label, $text',
          excludeSemantics: true,
          child: Material(
            color: Kf.surface,
            borderRadius: BorderRadius.circular(Kf.radiusControl),
            child: InkWell(
              borderRadius: BorderRadius.circular(Kf.radiusControl),
              onTap: onTap,
              child: Container(
                height: 48,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(Kf.radiusControl), border: Border.all(color: Kf.lineStrong)),
                child: Row(
                  children: [
                    Icon(icon, size: 16, color: empty ? Kf.muted2 : Kf.blue),
                    const SizedBox(width: 8),
                    Expanded(child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13.5, color: empty ? Kf.muted3 : Kf.ink))),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: box(
            label: dateLabel ?? l.t('ডেলিভারি তারিখ', 'Delivery date'),
            icon: LucideIcons.calendarDays,
            empty: value.date.isEmpty,
            text: value.date.isEmpty ? l.t('তারিখ বাছুন', 'Pick a date') : l.formatDate(value.date),
            onTap: () async {
              final now = nowInDhaka();
              final today = DateTime(now.year, now.month, now.day);
              final current = DateTime.tryParse(value.date);
              final picked = await showDatePicker(
                context: context,
                firstDate: today,
                lastDate: today.add(const Duration(days: 365)),
                initialDate: current != null && !current.isBefore(today) ? current : today,
              );
              if (picked != null) onChanged(value.copyWith(date: isoDate(picked)));
            },
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: box(
            label: timeLabel ?? l.t('ডেলিভারি টাইম', 'Delivery time'),
            icon: LucideIcons.clock,
            empty: time == null,
            text: time == null ? l.t('সময় বাছুন', 'Pick a time') : localizations.formatTimeOfDay(time),
            onTap: () async {
              final picked = await showTimePicker(context: context, initialTime: time ?? const TimeOfDay(hour: 10, minute: 0));
              if (picked != null) onChanged(value.copyWith(time: hhmm(picked.hour, picked.minute)));
            },
          ),
        ),
      ],
    );
  }

  static TimeOfDay? _parseTime(String value) {
    final match = RegExp(r'^(\d{2}):(\d{2})$').firstMatch(value);
    return match == null ? null : TimeOfDay(hour: int.parse(match[1]!), minute: int.parse(match[2]!));
  }
}

/// The "… ডেলিভারির সময় সূচী" notice; nothing when the service takes any time.
class DeliveryHoursNote extends ConsumerWidget {
  const DeliveryHoursNote({super.key, required this.service, required this.windows});

  final ServiceId service;
  final List<DeliveryWindow> windows;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notice = deliveryHoursNotice(service, windows);
    if (notice == null) return const SizedBox.shrink();
    return NoteBox(text: ref.watch(l10nProvider).text(notice), icon: LucideIcons.clock, tone: NoteTone.orange);
  }
}

/// A bill line: a number as it is (the sketches print no currency on lines), or text still to come (orange).
class BillLine {
  const BillLine(this.label, {this.amount, this.pending});

  final String label;
  final int? amount;
  final String? pending;
}

/// The bill, right-aligned: its lines, a navy rule and the total (the website's BillSummary).
class BillSummary extends StatelessWidget {
  const BillSummary({super.key, required this.lines, required this.totalLabel, required this.total, this.withCurrency});

  final List<BillLine> lines;
  final String totalLabel;
  final String total;

  /// Lines formatted as money (the price card does this).
  final String Function(int amount)? withCurrency;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 300),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final line in lines)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: Text('${line.label}:', style: const TextStyle(fontSize: 13, color: Kf.ink2))),
                    const SizedBox(width: 12),
                    Text(
                      line.pending ?? (withCurrency?.call(line.amount ?? 0) ?? '${line.amount ?? 0}'),
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: line.pending != null ? Kf.orangeInk : Kf.ink),
                    ),
                  ],
                ),
              ),
            const Padding(padding: EdgeInsets.symmetric(vertical: 6), child: Divider(color: Kf.navy, thickness: 2, height: 2)),
            // The label keeps its own width and the total takes the rest, so "230 টাকা + বাজারের দাম"
            // stays on one line.
            Row(
              children: [
                Text(totalLabel, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Kf.navy)),
                const SizedBox(width: 12),
                Expanded(child: Text(total, textAlign: TextAlign.right, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Kf.blue))),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// "We will check the prices and send you the full bill" (bazar, medicine, shifting).
class QuoteNotice extends ConsumerWidget {
  const QuoteNotice(this.service, {super.key});

  final ServiceId service;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    final shared = l.t(
      'অর্ডার পাঠালে আমরা দাম যাচাই করে পুরো বিল জানাব। দাম দেখে আপনি কনফার্ম করলে তবেই অর্ডার বুক হবে।',
      'Send the order and we will check the prices and send you the full bill. It is booked only after you confirm it.',
    );
    final own = switch (service) {
      ServiceId.bazar => l.t(
        'দূরত্ব বা বাজারের পরিমাণ অনুযায়ী মজুরী ও ডেলিভারী খরচ বদলাতে পারে; বিলে তা দেখতে পাবেন।',
        'The shopping fee and delivery charge may change with the distance or the size of the bazar; the bill shows it.',
      ),
      ServiceId.shifting => l.t(
        'গাড়ী ভাড়া Loading ও Unloading Area-র দূরত্ব দেখে ঠিক হবে; লেবার ও ফ্লোরের খরচ উপরের রেটেই।',
        'The vehicle rent depends on the distance between the loading and unloading areas; labour and floors are charged at the rates shown.',
      ),
      ServiceId.medicine => l.t('দূরত্ব অনুযায়ী ডেলিভারী চার্জ বদলাতে পারে; বিলে তা দেখতে পাবেন।', 'The delivery charge may change with the distance; the bill shows it.'),
      ServiceId.parcel => '',
    };
    return NoteBox(text: own.isEmpty ? shared : '$shared $own', icon: LucideIcons.info);
  }
}

/// Name, location, mobile and points, as the sketches put them above each form.
class CustomerInfo extends ConsumerWidget {
  const CustomerInfo({super.key, required this.customer, this.showPoints = true});

  final Customer customer;
  final bool showPoints;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    Widget item(String label, String value) => Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('$label: ', style: const TextStyle(fontSize: 11.5, color: Kf.muted)),
        Expanded(child: Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Kf.navy))),
      ],
    );
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(color: Kf.blueTint, borderRadius: BorderRadius.circular(14), border: Border.all(color: Kf.blueSoft2)),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(child: item(l.t('নাম', 'Name'), customer.name)),
              const SizedBox(width: 10),
              Expanded(child: item(l.t('মোবা', 'Mobile'), customer.mobile)),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(flex: showPoints ? 2 : 1, child: item(l.t('লোকেশন', 'Location'), customer.location?.text ?? '—')),
              if (showPoints) ...[const SizedBox(width: 10), Expanded(child: item(l.t('point', 'Points'), '${customer.points}'))],
            ],
          ),
        ],
      ),
    );
  }
}

/// A count with − and + (labourers, floors).
class CountStepper extends ConsumerWidget {
  const CountStepper({super.key, required this.value, required this.onChanged, required this.max, required this.label});

  final int value;
  final ValueChanged<int> onChanged;
  final int max;
  final String label;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    Widget button(IconData icon, String tip, int? next) => IconButton(
      tooltip: tip,
      visualDensity: VisualDensity.compact,
      style: IconButton.styleFrom(minimumSize: const Size(40, 44), foregroundColor: Kf.blue),
      onPressed: next == null
          ? null
          : () {
              HapticFeedback.selectionClick();
              onChanged(next);
            },
      icon: Icon(icon, size: 16),
    );
    return Semantics(
      label: label,
      value: '$value',
      child: Container(
        height: 46,
        decoration: BoxDecoration(color: Kf.surface, borderRadius: BorderRadius.circular(Kf.radiusControl), border: Border.all(color: Kf.lineStrong)),
        child: Row(
          children: [
            button(LucideIcons.minus, l.t('$label কমান', 'Fewer: $label'), value > 0 ? value - 1 : null),
            Expanded(child: Text('$value', textAlign: TextAlign.center, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Kf.navy))),
            button(LucideIcons.plus, l.t('$label বাড়ান', 'More: $label'), value < max ? value + 1 : null),
          ],
        ),
      ),
    );
  }
}
