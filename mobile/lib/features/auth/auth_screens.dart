import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../ui/lucide.dart';
import '../../config.dart';
import '../../core/api.dart';
import '../../core/data.dart';
import '../../core/domain.dart';
import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/messages.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../core/validation.dart';
import '../../ui/address_field.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

const _welcome = Bilingual('কিংফিশার-এ স্বাগতম', 'WELCOME TO KINGFISHER');
const _tagline = Bilingual('উন্নত জীবনের – সহজ সমাধান', 'Better living – simple solutions');

/// While the saved session is checked at launch, or when the server couldn't be reached to check it.
class StartingScreen extends ConsumerWidget {
  const StartingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offline = ref.watch(sessionProvider) is SessionOffline;
    return Scaffold(
      backgroundColor: Kf.surface,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Image.asset('assets/logo/logo-512.webp', width: 112, height: 112),
                const SizedBox(height: 24),
                if (offline)
                  ErrorRetry(code: 'network', onRetry: () => ref.read(sessionProvider.notifier).restore())
                else
                  const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2.4)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The entry screen (the website's /app welcome): the Old Dhaka photo with the logo, the language,
/// sign up and login, and the four services.
class WelcomeScreen extends ConsumerWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    final session = ref.watch(sessionProvider);
    final reason = session is SignedOut ? session.reason : null;
    final width = MediaQuery.sizeOf(context).width;
    return Scaffold(
      backgroundColor: Kf.surface,
      body: SafeArea(
        child: Stack(
          children: [
            ListView(
              padding: EdgeInsets.fromLTRB(22, 18, 22, 96 + MediaQuery.paddingOf(context).bottom),
              children: [
                Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 460),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Stack(
                          clipBehavior: Clip.none,
                          alignment: Alignment.bottomCenter,
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(22),
                              child: AspectRatio(
                                aspectRatio: 16 / 10,
                                child: Stack(
                                  fit: StackFit.expand,
                                  children: [
                                    Image.asset('assets/images/welcome-800.webp', fit: BoxFit.cover, semanticLabel: l.t('পুরান ঢাকায় ফলের দোকান', 'Fruit stalls in Old Dhaka')),
                                    DecoratedBox(
                                      decoration: BoxDecoration(
                                        gradient: LinearGradient(
                                          begin: Alignment.topCenter,
                                          end: Alignment.bottomCenter,
                                          colors: [Colors.transparent, Kf.navy.withValues(alpha: 0.45)],
                                          stops: const [0.5, 1],
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            Positioned(
                              bottom: -44,
                              child: Container(
                                width: 96,
                                height: 96,
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: Kf.surface,
                                  shape: BoxShape.circle,
                                  border: Border.all(color: Kf.teal.withValues(alpha: 0.35), width: 4),
                                  boxShadow: Kf.shadowRaised,
                                ),
                                child: Image.asset('assets/logo/logo-512.webp', semanticLabel: appName.of(ref.watch(langProvider))),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 60),
                        if (reason != null) ...[
                          reason == 'account.deleted'
                              ? NoteBox(text: l.text(messageText(reason)), icon: LucideIcons.circleCheck, tone: NoteTone.green)
                              : FormErrorBox(code: reason),
                          const SizedBox(height: 16),
                        ],
                        Text(l.text(_welcome), textAlign: TextAlign.center, style: const TextStyle(color: Kf.blue, fontSize: 12, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 6),
                        Text(l.text(_tagline), textAlign: TextAlign.center, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: Kf.navy, height: 1.3)),
                        const SizedBox(height: 8),
                        Text(
                          l.t('কাঁচা বাজার, বাসা বদল, জরুরী ঔষুধ ও পণ্য আদান প্রদান।', 'Fresh market, house shifting, emergency medicine and parcel delivery.'),
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Kf.muted, fontSize: 14, height: 1.6),
                        ),
                        const SizedBox(height: 24),
                        const Center(child: LangToggle()),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            Expanded(child: PrimaryButton(label: l.t('সাইন আপ', 'Sign up'), icon: LucideIcons.userPlus, onPressed: () => context.go('/signup'))),
                            const SizedBox(width: 10),
                            Expanded(child: SecondaryButton(label: l.t('লগইন', 'Login'), icon: LucideIcons.logIn, onPressed: () => context.go('/login'))),
                          ],
                        ),
                        const SizedBox(height: 28),
                        Row(
                          children: [
                            for (final service in ServiceId.values) ...[
                              if (service.index > 0) const SizedBox(width: 8),
                              Expanded(
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
                                  decoration: BoxDecoration(color: ServiceTone.of(service).soft, borderRadius: BorderRadius.circular(14)),
                                  child: Column(
                                    children: [
                                      Icon(ServiceTone.of(service).icon, size: 20, color: ServiceTone.of(service).color),
                                      const SizedBox(height: 7),
                                      Text(
                                        l.text(service.label),
                                        textAlign: TextAlign.center,
                                        style: TextStyle(fontSize: width < 360 ? 10 : 11, fontWeight: FontWeight.w600, color: ServiceTone.of(service).ink, height: 1.3),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 24),
                        const Center(child: DeveloperCredit()),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            if (!keyboardOpen(context)) Positioned(left: 0, right: 0, bottom: 16, child: const Center(child: ContactDock())),
          ],
        ),
      ),
    );
  }
}

/// Login and sign up (the website's AuthScreen). While the Super admin's switch is off (the
/// production default) the mobile number alone signs up and logs in.
class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key, required this.signup});

  final bool signup;

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final _name = TextEditingController();
  final _mobile = TextEditingController();
  final _password = TextEditingController();
  final _mobileFocus = FocusNode();
  Place? _location;
  bool _showPassword = false;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Checked when the box loses focus, as on the website.
    _mobileFocus.addListener(() {
      // Focus also drops while the screen is being closed.
      if (!mounted) return;
      final value = _mobile.text;
      if (!_mobileFocus.hasFocus && value.trim().isNotEmpty && !mobilePattern.hasMatch(normalizeMobile(value))) {
        setState(() => _error = 'mobile.invalid');
      }
    });
  }

  @override
  void dispose() {
    _name.dispose();
    _mobile.dispose();
    _password.dispose();
    _mobileFocus.dispose();
    super.dispose();
  }

  void _changed() {
    if (_error != null) setState(() => _error = null);
  }

  Future<void> _submit(bool passwordOn) async {
    final password = passwordOn ? _password.text : null;
    final check = widget.signup
        ? validateSignup(name: _name.text, mobile: _mobile.text, location: _location, password: password, passwordOn: passwordOn)
        : validateLogin(mobile: _mobile.text, password: password, passwordOn: passwordOn);
    if (check != null) return setState(() => _error = check);
    setState(() {
      _busy = true;
      _error = null;
    });
    final session = ref.read(sessionProvider.notifier);
    try {
      if (widget.signup) {
        await session.signup(name: _name.text.trim(), mobile: normalizeMobile(_mobile.text), location: _location!, password: password);
      } else {
        await session.login(mobile: normalizeMobile(_mobile.text), password: password);
      }
      // The router moves on to the home screen.
    } catch (error) {
      if (mounted) setState(() => _error = errorCode(error, formErrorPriority[widget.signup ? 'signup' : 'login']!));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = ref.watch(l10nProvider);
    final catalog = ref.watch(catalogProvider).value;
    final passwordOn = catalog?.passwordOn ?? false;
    final signup = widget.signup;

    return Scaffold(
      backgroundColor: Kf.surface,
      body: SafeArea(
        child: Stack(
          children: [
            ListView(
              padding: EdgeInsets.fromLTRB(22, 16, 22, 96 + MediaQuery.paddingOf(context).bottom),
              children: [
                Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 460),
                    child: AutofillGroup(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Align(alignment: Alignment.centerLeft, child: KfLogo()),
                          const SizedBox(height: 28),
                          Row(
                            children: [
                              TextButton.icon(
                                onPressed: () => context.go('/welcome'),
                                icon: const Icon(LucideIcons.arrowLeft, size: 15),
                                label: Text(l.t('ফিরে যান', 'Back')),
                              ),
                              const Spacer(),
                              const LangToggle(compact: true),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Semantics(
                            header: true,
                            child: Text(signup ? l.t('সাইন আপ', 'Sign up') : l.t('লগইন', 'Login'), style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: Kf.navy)),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            signup
                                ? l.t('নতুন অ্যাকাউন্ট খুলুন, সব সেবা এক জায়গায় পান।', 'Create an account to use every service.')
                                : l.t('আপনার মোবাইল নম্বর দিয়ে লগইন করুন।', 'Log in with your mobile number.'),
                            style: const TextStyle(color: Kf.muted, fontSize: 13.5, height: 1.6),
                          ),
                          const SizedBox(height: 22),
                          if (signup) ...[
                            LabeledField(
                              label: l.t('নাম', 'Name'),
                              child: TextField(
                                controller: _name,
                                onChanged: (_) => _changed(),
                                textInputAction: TextInputAction.next,
                                textCapitalization: TextCapitalization.words,
                                autofillHints: const [AutofillHints.name],
                                maxLength: 80,
                                decoration: InputDecoration(hintText: l.t('আপনার নাম', 'Your name'), prefixIcon: const Icon(LucideIcons.userRound, size: 17), counterText: ''),
                              ),
                            ),
                            const SizedBox(height: 14),
                          ],
                          LabeledField(
                            label: l.t('মোবাইল নম্বর', 'Mobile number'),
                            child: TextField(
                              controller: _mobile,
                              focusNode: _mobileFocus,
                              onChanged: (_) => _changed(),
                              keyboardType: TextInputType.phone,
                              textInputAction: passwordOn || signup ? TextInputAction.next : TextInputAction.done,
                              autofillHints: const [AutofillHints.telephoneNumber],
                              maxLength: 16,
                              // Digits (Latin or Bangla), +, spaces and dashes; +880 and the rest are normalised.
                              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9০-৯+\s-]'))],
                              onSubmitted: (_) => passwordOn || signup ? null : _submit(passwordOn),
                              decoration: const InputDecoration(hintText: '01XXXXXXXXX', prefixIcon: Icon(LucideIcons.phone, size: 17), counterText: ''),
                            ),
                          ),
                          if (signup) ...[
                            const SizedBox(height: 14),
                            AddressField(
                              label: l.t('লোকেশন', 'Location'),
                              value: _location,
                              onChanged: (place) {
                                setState(() => _location = place);
                                _changed();
                              },
                            ),
                          ],
                          if (passwordOn) ...[
                            const SizedBox(height: 14),
                            LabeledField(
                              label: l.t('পাসওয়ার্ড', 'Password'),
                              child: TextField(
                                controller: _password,
                                onChanged: (_) => _changed(),
                                obscureText: !_showPassword,
                                autofillHints: [signup ? AutofillHints.newPassword : AutofillHints.password],
                                onSubmitted: (_) => _submit(passwordOn),
                                decoration: InputDecoration(
                                  hintText: l.t('পাসওয়ার্ড দিন', 'Enter password'),
                                  prefixIcon: const Icon(LucideIcons.lockKeyhole, size: 17),
                                  suffixIcon: IconButton(
                                    tooltip: _showPassword ? l.t('পাসওয়ার্ড লুকান', 'Hide password') : l.t('পাসওয়ার্ড দেখুন', 'Show password'),
                                    icon: Icon(_showPassword ? LucideIcons.eyeOff : LucideIcons.eye, size: 17),
                                    onPressed: () => setState(() => _showPassword = !_showPassword),
                                  ),
                                ),
                              ),
                            ),
                          ],
                          const SizedBox(height: 16),
                          if (_error != null) ...[FormErrorBox(code: _error), const SizedBox(height: 12)],
                          PrimaryButton(
                            label: signup ? l.t('সাইন আপ', 'Sign up') : l.t('লগইন', 'Login'),
                            icon: signup ? LucideIcons.userPlus : LucideIcons.logIn,
                            busy: _busy,
                            onPressed: () => _submit(passwordOn),
                          ),
                          if (signup) ...[
                            const SizedBox(height: 12),
                            Text.rich(
                              TextSpan(
                                style: const TextStyle(fontSize: 12, color: Kf.muted, height: 1.6),
                                children: [
                                  TextSpan(text: l.t('সাইন আপ করে আপনি আমাদের ', 'By signing up you agree to our ')),
                                  WidgetSpan(
                                    alignment: PlaceholderAlignment.baseline,
                                    baseline: TextBaseline.alphabetic,
                                    child: GestureDetector(
                                      onTap: () => openLink(Uri.parse(AppConfig.privacyUrl), inApp: true),
                                      child: Text(l.t('প্রাইভেসি পলিসি', 'Privacy Policy'), style: const TextStyle(fontSize: 12, color: Kf.blue, fontWeight: FontWeight.w600)),
                                    ),
                                  ),
                                  TextSpan(text: l.t(' মেনে নিচ্ছেন।', '.')),
                                ],
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ],
                          const SizedBox(height: 14),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Flexible(
                                child: Text(
                                  signup ? l.t('আগে থেকেই অ্যাকাউন্ট আছে?', 'Already have an account?') : l.t('নতুন গ্রাহক?', 'New to Kingfisher?'),
                                  style: const TextStyle(color: Kf.muted, fontSize: 13),
                                ),
                              ),
                              TextButton(
                                onPressed: () => context.go(signup ? '/login' : '/signup'),
                                child: Text(signup ? l.t('লগইন', 'Login') : l.t('সাইন আপ', 'Sign up')),
                              ),
                            ],
                          ),
                          if (catalog != null && catalog.supportPhone.isNotEmpty)
                            Center(
                              child: TextButton.icon(
                                onPressed: () => openLink(Uri(scheme: 'tel', path: catalog.supportPhone)),
                                icon: const Icon(LucideIcons.headset, size: 15),
                                label: Text(
                                  signup ? l.t('সাহায্য দরকার? কল করুন ${catalog.supportPhone}', 'Need help? Call ${catalog.supportPhone}') : l.t('লগইনে সমস্যা? কল করুন ${catalog.supportPhone}', 'Trouble logging in? Call ${catalog.supportPhone}'),
                                  style: const TextStyle(fontSize: 12.5),
                                ),
                              ),
                            ),
                          const SizedBox(height: 10),
                          const Center(child: DeveloperCredit()),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
            if (!keyboardOpen(context)) Positioned(left: 0, right: 0, bottom: 16, child: const Center(child: ContactDock())),
          ],
        ),
      ),
    );
  }
}
