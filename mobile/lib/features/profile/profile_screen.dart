import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../ui/lucide.dart';
import '../../config.dart';
import '../../core/api.dart';
import '../../core/data.dart';
import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/notifications.dart';
import '../../core/session.dart';
import '../../core/validation.dart';
import '../../ui/location_sheet.dart';
import '../../ui/page.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../shell/main_shell.dart';

final _versionProvider = FutureProvider<String>((ref) async {
  final info = await PackageInfo.fromPlatform();
  return '${info.version} (${info.buildNumber})';
});

/// প্রোফাইল (the website's features/profile.tsx), plus what the app adds: the language, the policy
/// pages, signing out, and deleting the account.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    final customer = ref.watch(customerProvider);
    final passwordOn = ref.watch(catalogProvider).value?.passwordOn ?? false;
    if (customer == null) return const SizedBox.shrink();
    const gap = SizedBox(height: 14);
    return PageScaffold(
      title: l.t('প্রোফাইল', 'My profile'),
      body: ListView(
        padding: pagePadding(context),
        children: [
          SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Avatar(customer.name, size: 46),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(customer.name, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Kf.navy)),
                          Text(customer.mobile, style: const TextStyle(color: Kf.muted)),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(color: Kf.orangeSoft, borderRadius: BorderRadius.circular(999)),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(LucideIcons.award, size: 15, color: Kf.orangeInk),
                          const SizedBox(width: 4),
                          Text('${l.t('point', 'Points')}: ${customer.points}', style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Kf.orangeInk)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                _ProfileForm(customer: customer),
              ],
            ),
          ),
          gap,
          SectionCard(child: _MyLocation(customer: customer)),
          if (passwordOn) ...[gap, const SectionCard(child: _ChangePassword())],
          gap,
          SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SectionTitle(l.t('অ্যাপ', 'App')),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(child: Text(l.t('ভাষা', 'Language'), style: const TextStyle(color: Kf.ink))),
                    const LangToggle(),
                  ],
                ),
                const Divider(height: 26),
                _LinkRow(icon: LucideIcons.shieldCheck, text: l.t('প্রাইভেসি পলিসি', 'Privacy policy'), onTap: () => openLink(Uri.parse(AppConfig.privacyUrl), inApp: true)),
                _LinkRow(icon: LucideIcons.logOut, text: l.t('সাইন আউট', 'Sign out'), onTap: () => confirmSignOut(context, ref)),
                const SizedBox(height: 6),
                Text(
                  l.t('ভার্শন ${ref.watch(_versionProvider).value ?? ''}', 'Version ${ref.watch(_versionProvider).value ?? ''}'),
                  style: const TextStyle(fontSize: 12, color: Kf.muted),
                ),
              ],
            ),
          ),
          gap,
          SectionCard(child: _DeleteAccount(customer: customer)),
          const SizedBox(height: 18),
          const Center(child: DeveloperCredit()),
        ],
      ),
    );
  }
}

class _LinkRow extends StatelessWidget {
  const _LinkRow({required this.icon, required this.text, required this.onTap});

  final IconData icon;
  final String text;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: SizedBox(
        height: 48,
        child: Row(
          children: [
            Icon(icon, size: 18, color: Kf.ink2),
            const SizedBox(width: 12),
            Expanded(child: Text(text, style: const TextStyle(color: Kf.ink))),
            const Icon(LucideIcons.chevronRight, size: 16, color: Kf.muted2),
          ],
        ),
      ),
    );
  }
}

class _ProfileForm extends ConsumerStatefulWidget {
  const _ProfileForm({required this.customer});

  final Customer customer;

  @override
  ConsumerState<_ProfileForm> createState() => _ProfileFormState();
}

class _ProfileFormState extends ConsumerState<_ProfileForm> {
  late final _name = TextEditingController(text: widget.customer.name);
  late final _mobile = TextEditingController(text: widget.customer.mobile);
  String? _error;
  bool _saved = false;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _mobile.dispose();
    super.dispose();
  }

  void _changed(String _) {
    if (_error != null || _saved) {
      setState(() {
        _error = null;
        _saved = false;
      });
    }
  }

  Future<void> _save() async {
    final check = validateProfile(name: _name.text, mobile: _mobile.text);
    if (check != null) return setState(() => _error = check);
    setState(() => _busy = true);
    try {
      final updated = await ref.read(apiProvider).updateProfile(name: _name.text.trim(), mobile: normalizeMobile(_mobile.text), lang: ref.read(langProvider));
      ref.read(sessionProvider.notifier).updateCustomer(updated);
      if (mounted) setState(() => _saved = true);
    } catch (error) {
      if (mounted) setState(() => _error = errorCode(error, const ['profile.name', 'profile.mobile', 'mobile.invalid']));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = ref.watch(l10nProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LabeledField(
          label: l.t('নাম', 'Name'),
          child: TextField(controller: _name, onChanged: _changed, maxLength: 80, autofillHints: const [AutofillHints.name], decoration: const InputDecoration(counterText: '')),
        ),
        const SizedBox(height: 12),
        LabeledField(
          label: l.t('মোবাইল নম্বর', 'Mobile number'),
          child: TextField(
            controller: _mobile,
            onChanged: _changed,
            keyboardType: TextInputType.phone,
            maxLength: 16,
            autofillHints: const [AutofillHints.telephoneNumber],
            decoration: const InputDecoration(counterText: ''),
          ),
        ),
        const SizedBox(height: 12),
        if (_saved) ...[NoteBox(text: l.t('প্রোফাইল সেভ হয়েছে।', 'Profile saved.'), icon: LucideIcons.circleCheck, tone: NoteTone.green), const SizedBox(height: 10)],
        if (_error != null) ...[FormErrorBox(code: _error), const SizedBox(height: 10)],
        PrimaryButton(label: l.t('প্রোফাইল সেভ করুন', 'Save profile'), icon: LucideIcons.check, busy: _busy, onPressed: _save),
      ],
    );
  }
}

/// আমার লোকেশন: the one location orders start from, always picked on the map.
class _MyLocation extends ConsumerStatefulWidget {
  const _MyLocation({required this.customer});

  final Customer customer;

  @override
  ConsumerState<_MyLocation> createState() => _MyLocationState();
}

class _MyLocationState extends ConsumerState<_MyLocation> {
  bool _saved = false;

  Future<void> _edit({required bool locate}) async {
    final l = ref.read(l10nProvider);
    setState(() => _saved = false);
    final place = await pickPlace(
      context,
      title: l.t('আমার লোকেশন', 'My location'),
      initial: widget.customer.location,
      locate: locate,
      submitLabel: l.t('সেভ করুন', 'Save'),
      onSave: (place) async {
        final updated = await ref.read(apiProvider).setLocation(place);
        ref.read(sessionProvider.notifier).updateCustomer(updated);
      },
    );
    if (place != null && mounted) setState(() => _saved = true);
  }

  @override
  Widget build(BuildContext context) {
    final l = ref.watch(l10nProvider);
    final location = widget.customer.location;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionTitle(l.t('আমার লোকেশন', 'My location'), note: l.t('অর্ডারের সময় এই লোকেশন আগে থেকেই বসানো থাকবে।', 'Your orders start with this location.')),
        const SizedBox(height: 12),
        if (location != null)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Kf.surface2, borderRadius: BorderRadius.circular(12), border: Border.all(color: Kf.line)),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(color: Kf.blueSoft, borderRadius: BorderRadius.circular(10)),
                  child: const Icon(LucideIcons.mapPin, size: 17, color: Kf.blue),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (location.details.isNotEmpty) Text(location.details, style: const TextStyle(fontWeight: FontWeight.w700, color: Kf.ink)),
                      Text(location.address, style: const TextStyle(fontSize: 13, color: Kf.ink2, height: 1.45)),
                      TextButton.icon(
                        style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 36)),
                        onPressed: () => openLink(location.pin.mapLink),
                        icon: const Icon(LucideIcons.externalLink, size: 13),
                        label: Text(l.t('ম্যাপে দেখুন', 'Open map')),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          )
        else
          Text(
            l.t('ম্যাপে আপনার লোকেশন দিন, তাহলে অর্ডারে ঠিকানা আগে থেকেই বসবে।', 'Set your location on the map so your orders start with it.'),
            style: const TextStyle(color: Kf.muted, height: 1.5),
          ),
        if (_saved) ...[const SizedBox(height: 10), NoteBox(text: l.t('লোকেশন সেভ হয়েছে।', 'Location saved.'), icon: LucideIcons.circleCheck, tone: NoteTone.green)],
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: SecondaryButton(
                label: location != null ? l.t('ম্যাপে পরিবর্তন করুন', 'Change on map') : l.t('ম্যাপে লোকেশন দিন', 'Set on map'),
                icon: LucideIcons.map,
                onPressed: () => _edit(locate: location == null),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(child: SecondaryButton(label: l.t('বর্তমান লোকেশন', 'Current location'), icon: LucideIcons.locateFixed, onPressed: () => _edit(locate: true))),
          ],
        ),
      ],
    );
  }
}

/// Only while the Super admin asks customers for a password. It ends every session, this one too.
class _ChangePassword extends ConsumerStatefulWidget {
  const _ChangePassword();

  @override
  ConsumerState<_ChangePassword> createState() => _ChangePasswordState();
}

class _ChangePasswordState extends ConsumerState<_ChangePassword> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    super.dispose();
  }

  Future<void> _change() async {
    final check = validateChangePassword(current: _current.text, next: _next.text);
    if (check != null) return setState(() => _error = check);
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).changePassword(current: _current.text, next: _next.text);
      // Every session ended, this one included: log in again with the new password.
      ref.read(sessionProvider.notifier).ended('auth.required');
    } catch (error) {
      if (mounted) setState(() => _error = errorCode(error, const ['password.wrong', 'password.short']));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = ref.watch(l10nProvider);
    void clear(String _) {
      if (_error != null) setState(() => _error = null);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionTitle(l.t('পাসওয়ার্ড বদলান', 'Change password')),
        const SizedBox(height: 12),
        LabeledField(
          label: l.t('বর্তমান পাসওয়ার্ড', 'Current password'),
          child: TextField(controller: _current, onChanged: clear, obscureText: true, autofillHints: const [AutofillHints.password]),
        ),
        const SizedBox(height: 12),
        LabeledField(
          label: l.t('নতুন পাসওয়ার্ড', 'New password'),
          child: TextField(controller: _next, onChanged: clear, obscureText: true, autofillHints: const [AutofillHints.newPassword]),
        ),
        const SizedBox(height: 12),
        if (_error != null) ...[FormErrorBox(code: _error), const SizedBox(height: 10)],
        SecondaryButton(label: l.t('পাসওয়ার্ড বদলান', 'Change password'), icon: LucideIcons.keyRound, busy: _busy, onPressed: _change),
      ],
    );
  }
}

/// Deleting the account (Google Play and App Store rule; the website has the same, and
/// /account-deletion explains it). The customer types their mobile number to confirm.
class _DeleteAccount extends ConsumerWidget {
  const _DeleteAccount({required this.customer});

  final Customer customer;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionTitle(
          l.t('অ্যাকাউন্ট মুছে ফেলুন', 'Delete your account'),
          note: l.t(
            'নাম, মোবাইল নম্বর, লোকেশন, নোটিফিকেশন আর প্রেসক্রিপশন মুছে যাবে, আর সব ডিভাইস থেকে লগআউট হবেন। আগের অর্ডার শুধু বিক্রির হিসাব হিসেবে থাকবে, আপনার পরিচয় ছাড়া। এটি আর ফেরানো যায় না।',
            'Your name, mobile number, location, notifications and prescriptions are deleted, and you are signed out everywhere. Past orders stay only as sales records, without anything that identifies you. This can’t be undone.',
          ),
        ),
        const SizedBox(height: 6),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            style: TextButton.styleFrom(padding: EdgeInsets.zero),
            onPressed: () => openLink(Uri.parse(AppConfig.accountDeletionUrl), inApp: true),
            child: Text(l.t('বিস্তারিত', 'Details')),
          ),
        ),
        const SizedBox(height: 6),
        SecondaryButton(
          label: l.t('অ্যাকাউন্ট মুছে ফেলুন', 'Delete account'),
          icon: LucideIcons.trash2,
          danger: true,
          expand: true,
          onPressed: () => showModalBottomSheet<void>(
            context: context,
            isScrollControlled: true,
            builder: (_) => _DeleteSheet(mobile: customer.mobile),
          ),
        ),
      ],
    );
  }
}

class _DeleteSheet extends ConsumerStatefulWidget {
  const _DeleteSheet({required this.mobile});

  final String mobile;

  @override
  ConsumerState<_DeleteSheet> createState() => _DeleteSheetState();
}

class _DeleteSheetState extends ConsumerState<_DeleteSheet> {
  final _typed = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _typed.dispose();
    super.dispose();
  }

  Future<void> _delete() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(apiProvider).deleteAccount();
      // The server already forgot this phone; clear what is on it.
      await ref.read(pushProvider).forgetDevice();
      if (mounted) Navigator.of(context).pop();
      ref.read(sessionProvider.notifier).ended('account.deleted');
    } catch (error) {
      if (mounted) setState(() => _error = errorCode(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = ref.watch(l10nProvider);
    final confirmed = normalizeMobile(_typed.text) == widget.mobile;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l.t('অ্যাকাউন্ট চিরতরে মুছবেন?', 'Delete your account for good?'), style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(
              l.t('চলমান অর্ডার থাকলে আগে তা শেষ হতে দিন বা বাতিল করুন।', 'If an order is still running, let it finish or cancel it first.'),
              style: const TextStyle(color: Kf.ink2, height: 1.5),
            ),
            const SizedBox(height: 14),
            LabeledField(
              label: l.t('নিশ্চিত করতে আপনার মোবাইল নম্বর (${widget.mobile}) লিখুন', 'Type your mobile number (${widget.mobile}) to confirm'),
              child: TextField(
                controller: _typed,
                keyboardType: TextInputType.phone,
                onChanged: (_) => setState(() => _error = null),
                decoration: const InputDecoration(hintText: '01XXXXXXXXX'),
              ),
            ),
            if (_error != null) ...[const SizedBox(height: 10), FormErrorBox(code: _error)],
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(child: SecondaryButton(label: l.t('থাক', 'Keep it'), icon: LucideIcons.x, onPressed: _busy ? null : () => Navigator.of(context).pop())),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(backgroundColor: Kf.danger, disabledBackgroundColor: Kf.dangerLine),
                    onPressed: confirmed && !_busy ? _delete : null,
                    icon: _busy ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(LucideIcons.trash2, size: 16),
                    label: Text(_busy ? l.t('অপেক্ষা করুন…', 'Please wait…') : l.t('চিরতরে মুছে ফেলুন', 'Delete for good')),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
