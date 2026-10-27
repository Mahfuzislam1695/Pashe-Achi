import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../core/i18n.dart';
import '../core/models.dart';
import 'location_sheet.dart';
import 'lucide.dart';
import 'theme.dart';
import 'widgets.dart';

/// An address box: nothing is typed into it; a tap opens the map (owner's rule: every location
/// comes from the map). Empty, it opens at the device's position.
class AddressField extends ConsumerWidget {
  const AddressField({super.key, required this.label, required this.value, required this.onChanged});

  final String label;
  final Place? value;
  final ValueChanged<Place> onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    final place = value;
    return LabeledField(
      label: label,
      child: Semantics(
        button: true,
        label: place == null ? '$label, ${l.t('ম্যাপে লোকেশন বাছুন', 'Pick the location on the map')}' : '$label, ${place.text}',
        excludeSemantics: true,
        child: Material(
          color: place == null ? Kf.blueTint : Kf.surface,
          borderRadius: BorderRadius.circular(Kf.radiusControl),
          child: InkWell(
            borderRadius: BorderRadius.circular(Kf.radiusControl),
            onTap: () async {
              final picked = await pickPlace(context, title: label, initial: place);
              if (picked != null) onChanged(picked);
            },
            child: Container(
              constraints: const BoxConstraints(minHeight: 48),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(Kf.radiusControl),
                border: Border.all(color: place == null ? Kf.blueLine : Kf.lineStrong),
              ),
              child: Row(
                children: [
                  Icon(LucideIcons.mapPin, size: 17, color: Kf.blue),
                  const SizedBox(width: 9),
                  Expanded(
                    child: place == null
                        ? Text(l.t('ম্যাপে লোকেশন বাছুন', 'Pick the location on the map'), style: const TextStyle(color: Kf.blue, fontWeight: FontWeight.w600, fontSize: 13.5))
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (place.details.trim().isNotEmpty)
                                Text(place.details, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: Kf.ink)),
                              Text(place.address, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, color: Kf.ink2, height: 1.4)),
                            ],
                          ),
                  ),
                  const SizedBox(width: 6),
                  const Icon(LucideIcons.chevronRight, size: 16, color: Kf.muted2),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
