import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config.dart';
import '../core/data.dart';
import '../core/domain.dart';
import '../core/i18n.dart';
import '../core/messages.dart';
import 'lucide.dart';
import 'theme.dart';

const appName = Bilingual('কিংফিশার', 'Kingfisher');

/// Opens a link outside the app (dialer, WhatsApp, Google Maps), or inside it for web pages.
Future<void> openLink(Uri uri, {bool inApp = false}) async {
  try {
    await launchUrl(uri, mode: inApp ? LaunchMode.inAppBrowserView : LaunchMode.externalApplication);
  } catch (_) {}
}

/// The logo with both names: "কিংফিশার" in bold over "Kingfisher" (the other language) in small.
class KfLogo extends ConsumerWidget {
  const KfLogo({super.key, this.size = 31});

  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(langProvider);
    final other = lang == Lang.bn ? Lang.en : Lang.bn;
    return Semantics(
      label: appName.of(lang),
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Image.asset('assets/logo/logo-mark.webp', width: size, height: size),
          const SizedBox(width: 8),
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(appName.of(lang), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Kf.navy, height: 1.15)),
              Text(appName.of(other), style: const TextStyle(fontSize: 10, color: Kf.muted, height: 1.2)),
            ],
          ),
        ],
      ),
    );
  }
}

/// বাংলা | English (compact: বাং | EN), as on the website.
class LangToggle extends ConsumerWidget {
  const LangToggle({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(langProvider);
    Widget segment(Lang value, String label) {
      final active = value == lang;
      return Semantics(
        button: true,
        selected: active,
        child: Material(
          color: active ? Kf.surface : Colors.transparent,
          borderRadius: BorderRadius.circular(9),
          elevation: active ? 1 : 0,
          shadowColor: const Color(0x2210213A),
          child: InkWell(
            borderRadius: BorderRadius.circular(9),
            onTap: () => ref.read(langProvider.notifier).set(value),
            child: Container(
              height: compact ? 30 : 38,
              constraints: BoxConstraints(minWidth: compact ? 38 : 64),
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: Text(
                label,
                style: TextStyle(fontSize: compact ? 11.5 : 13, fontWeight: FontWeight.w600, color: active ? Kf.blue : Kf.muted),
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(color: Kf.surface3, borderRadius: BorderRadius.circular(12)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [segment(Lang.bn, compact ? 'বাং' : 'বাংলা'), segment(Lang.en, compact ? 'EN' : 'English')],
      ),
    );
  }
}

/// The main action: blue, full width by default, with a spinner while [busy].
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({super.key, required this.label, this.icon, this.onPressed, this.busy = false, this.expand = true});

  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final bool busy;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final child = Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (busy)
          const SizedBox(width: 17, height: 17, child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white))
        else if (icon != null)
          Icon(icon, size: 17),
        if (busy || icon != null) const SizedBox(width: 8),
        Flexible(child: Text(label, textAlign: TextAlign.center)),
      ],
    );
    final button = FilledButton(
      onPressed: busy || onPressed == null
          ? null
          : () {
              HapticFeedback.lightImpact();
              onPressed!();
            },
      child: child,
    );
    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}

/// The secondary action: white with a grey border ([danger]: red text).
class SecondaryButton extends StatelessWidget {
  const SecondaryButton({super.key, required this.label, this.icon, this.onPressed, this.busy = false, this.danger = false, this.expand = false});

  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final bool busy;
  final bool danger;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final color = danger ? Kf.dangerInk : Kf.ink;
    final button = OutlinedButton(
      onPressed: busy ? null : onPressed,
      style: OutlinedButton.styleFrom(foregroundColor: color, side: BorderSide(color: danger ? Kf.dangerLine : Kf.lineStrong)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (busy)
            SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: color))
          else if (icon != null)
            Icon(icon, size: 16),
          if (busy || icon != null) const SizedBox(width: 8),
          Flexible(child: Text(label, textAlign: TextAlign.center)),
        ],
      ),
    );
    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}

/// A label above its control (the website's .field).
class LabeledField extends StatelessWidget {
  const LabeledField({super.key, required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(label, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Kf.ink2)),
        const SizedBox(height: 7),
        child,
      ],
    );
  }
}

/// The one message a form shows, in red, read out when it appears.
class FormErrorBox extends ConsumerWidget {
  const FormErrorBox({super.key, required this.code, this.text});

  final String? code;

  /// Already-worded text (e.g. from the server); wins over [code].
  final String? text;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (code == null && text == null) return const SizedBox.shrink();
    final l = ref.watch(l10nProvider);
    return Semantics(
      liveRegion: true,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(color: Kf.dangerSoft, border: Border.all(color: Kf.dangerLine), borderRadius: BorderRadius.circular(12)),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(padding: EdgeInsets.only(top: 2), child: Icon(LucideIcons.circleAlert, size: 16, color: Kf.dangerInk)),
            const SizedBox(width: 8),
            Expanded(child: Text(text ?? l.text(messageText(code)), style: const TextStyle(color: Kf.dangerInk, fontSize: 13, fontWeight: FontWeight.w500))),
          ],
        ),
      ),
    );
  }
}

enum NoteTone { blue, orange, green }

/// A tinted note: blue for information, orange for the delivery hours, green for success.
class NoteBox extends StatelessWidget {
  const NoteBox({super.key, required this.text, this.icon, this.tone = NoteTone.blue, this.child});

  final String text;
  final IconData? icon;
  final NoteTone tone;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final (background, border, foreground) = switch (tone) {
      NoteTone.blue => (Kf.blueTint, Kf.blueSoft2, Kf.ink2),
      NoteTone.orange => (Kf.orangeSoft, Kf.orangeLine, Kf.orangeInk),
      NoteTone.green => (Kf.greenSoft, Kf.greenLine, Kf.greenInk),
    };
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(color: background, border: Border.all(color: border), borderRadius: BorderRadius.circular(12)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (icon != null) ...[Padding(padding: const EdgeInsets.only(top: 2), child: Icon(icon, size: 16, color: foreground)), const SizedBox(width: 8)],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(text, style: TextStyle(color: foreground, fontSize: 12.5, height: 1.55)),
                ?child,
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A white card (radius 16, hairline border, soft shadow): the website's .page-card.
class SectionCard extends StatelessWidget {
  const SectionCard({super.key, required this.child, this.padding = const EdgeInsets.all(17)});

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: Kf.surface,
        borderRadius: BorderRadius.circular(Kf.radiusCard),
        border: Border.all(color: Kf.line),
        boxShadow: Kf.shadowCard,
      ),
      child: child,
    );
  }
}

/// A heading inside a card, with an optional note under it.
class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.note});

  final String title;
  final String? note;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(header: true, child: Text(title, style: Theme.of(context).textTheme.titleMedium)),
        if (note != null) ...[const SizedBox(height: 4), Text(note!, style: const TextStyle(fontSize: 12.5, color: Kf.muted, height: 1.5))],
      ],
    );
  }
}

/// An order's status as a coloured pill.
class StatusPill extends ConsumerWidget {
  const StatusPill(this.status, {super.key});

  final OrderStatus status;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    final (background, foreground) = switch (status) {
      OrderStatus.pending => (Kf.warnSoft, Kf.warnInk),
      OrderStatus.quoted => (Kf.orangeSoft, Kf.orangeInk),
      OrderStatus.booked => (Kf.blueSoft, Kf.blueInk),
      OrderStatus.inProgress => (Kf.violetSoft, Kf.violetInk),
      OrderStatus.completed => (Kf.greenSoft, Kf.greenInk),
      OrderStatus.cancelled => (Kf.dangerSoft, Kf.dangerInk),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
        border: status == OrderStatus.quoted ? Border.all(color: Kf.orangeLine) : null,
      ),
      child: Text(l.text(status.label), style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: foreground)),
    );
  }
}

/// Chat (WhatsApp) and Call (the support phone), from the live Catalog. Literal "Chat"/"Call" as in the sketches.
class ContactDock extends ConsumerWidget {
  const ContactDock({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalog = ref.watch(catalogProvider).value;
    if (catalog == null) return const SizedBox.shrink();
    final l = ref.watch(l10nProvider);
    Widget pill({required String label, required IconData icon, required bool primary, required String tooltip, required VoidCallback onTap}) {
      return Tooltip(
        message: tooltip,
        child: Material(
          color: primary ? Kf.blue : Kf.surface,
          borderRadius: BorderRadius.circular(999),
          elevation: 3,
          shadowColor: const Color(0x4010213A),
          child: InkWell(
            borderRadius: BorderRadius.circular(999),
            onTap: onTap,
            child: Container(
              height: 46,
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: Row(
                children: [
                  Icon(icon, size: 17, color: primary ? Colors.white : Kf.blue),
                  const SizedBox(width: 7),
                  Text(label, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: primary ? Colors.white : Kf.blue)),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (catalog.supportWhatsapp.isNotEmpty)
          pill(
            label: 'Chat',
            icon: LucideIcons.messageCircle,
            primary: false,
            tooltip: l.t('WhatsApp-এ চ্যাট করুন', 'Chat on WhatsApp'),
            onTap: () => openLink(Uri.parse(catalog.supportWhatsapp)),
          ),
        const SizedBox(width: 10),
        if (catalog.supportPhone.isNotEmpty)
          pill(
            label: 'Call',
            icon: LucideIcons.phone,
            primary: true,
            tooltip: l.t('সাপোর্টে কল করুন', 'Call support'),
            onTap: () => openLink(Uri(scheme: 'tel', path: catalog.supportPhone)),
          ),
      ],
    );
  }
}

/// "Developed by Aethrasoft", linking to the developer's site.
class DeveloperCredit extends ConsumerWidget {
  const DeveloperCredit({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    return Semantics(
      link: true,
      label: l.t('${AppConfig.developerName} ডেভেলপ করেছে', 'Developed by ${AppConfig.developerName}'),
      excludeSemantics: true,
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: () => openLink(Uri.parse(AppConfig.developerUrl), inApp: true),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(color: Kf.surface, borderRadius: BorderRadius.circular(999), border: Border.all(color: Kf.line)),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(LucideIcons.codeXml, size: 13, color: Kf.muted),
              const SizedBox(width: 6),
              Text(l.t('ডেভেলপ করেছে', 'Developed by'), style: const TextStyle(fontSize: 11.5, color: Kf.muted)),
              const SizedBox(width: 5),
              ShaderMask(
                shaderCallback: (bounds) => const LinearGradient(colors: [Kf.tealInk, Kf.blue]).createShader(bounds),
                child: const Text(AppConfig.developerName, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Colors.white)),
              ),
              const SizedBox(width: 3),
              const Icon(LucideIcons.arrowUpRight, size: 13, color: Kf.muted),
            ],
          ),
        ),
      ),
    );
  }
}

/// "Loading…", for the moment before a list arrives.
class LoadingNote extends ConsumerWidget {
  const LoadingNote({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 28),
      child: Center(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2)),
            const SizedBox(width: 10),
            Text(l.t('লোড হচ্ছে…', 'Loading…'), style: const TextStyle(color: Kf.muted)),
          ],
        ),
      ),
    );
  }
}

/// A failed load: what happened, and a way to try again.
class ErrorRetry extends ConsumerWidget {
  const ErrorRetry({super.key, required this.code, required this.onRetry});

  final String code;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Column(
        children: [
          FormErrorBox(code: code),
          const SizedBox(height: 12),
          SecondaryButton(label: l.t('আবার চেষ্টা করুন', 'Try again'), icon: LucideIcons.rotateCw, onPressed: onRetry),
        ],
      ),
    );
  }
}

/// An empty list, said plainly.
class EmptyNote extends StatelessWidget {
  const EmptyNote(this.text, {super.key, this.icon = LucideIcons.inbox});

  final String text;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 12),
      child: Column(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: const BoxDecoration(color: Kf.blueSoft, shape: BoxShape.circle),
            child: Icon(icon, color: Kf.blue, size: 24),
          ),
          const SizedBox(height: 12),
          Text(text, textAlign: TextAlign.center, style: const TextStyle(color: Kf.muted, height: 1.6)),
        ],
      ),
    );
  }
}

/// The first letter of a name (whole Bangla letters, not half a cluster).
String initialOf(String name) => name.trim().isEmpty ? '?' : name.trim().characters.first.toUpperCase();

/// The blue circle with the customer's initial.
class Avatar extends StatelessWidget {
  const Avatar(this.name, {super.key, this.size = 34});

  final String name;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(color: Kf.blue, shape: BoxShape.circle),
      child: Text(initialOf(name), style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: size * 0.42)),
    );
  }
}
