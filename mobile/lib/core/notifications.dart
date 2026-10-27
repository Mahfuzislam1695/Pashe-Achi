import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../ui/lucide.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'data.dart';
import 'i18n.dart';
import 'models.dart';
import 'session.dart';

/// The navigator the router builds on; notifications open screens and sheets through it.
final rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');

/// Set by the router once it exists, so a tapped notification can open its screen.
GoRouter? appRouter;

enum PushStatus {
  /// Popups on: the phone allows them and the customer hasn't turned them off.
  on,

  /// Turned off here, or not asked yet.
  off,

  /// The phone refuses (Android 13+ or iOS permission denied): only the system settings can change it.
  blocked,
}

const _offKey = 'push_off';
const _askedKey = 'push_asked';

/// Order and offer popups, the way the owner asked for them: a heads-up notification on the phone.
///
/// - With Firebase set up (google-services.json / GoogleService-Info.plist, and FCM_SERVICE_ACCOUNT
///   on the server), the server pushes every notification through FCM, so it pops up even when the
///   app is closed. In the foreground the same message is shown here.
/// - Without it, the live socket brings each notification while the app runs, and it is shown here.
///
/// Either way one notification shows once, and a newer one about the same order replaces it.
class PushService {
  PushService(this._ref);

  final Ref _ref;
  final _local = FlutterLocalNotificationsPlugin();
  final _shown = <String>{};
  bool _ready = false;
  bool _firebase = false;
  String? _token;
  String? _version;

  /// A tapped notification that arrived before the app could open it (launch from a notification).
  String? pendingRoute;

  /// Firebase is set up in this build.
  bool get hasFirebase => _firebase;

  /// The server sends this phone push (so the socket only updates the screen).
  bool get fcmActive => _token != null;

  AndroidFlutterLocalNotificationsPlugin? get _android => _local.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

  Future<void> init() async {
    if (_ready) return;
    _ready = true;
    try {
      _version = (await PackageInfo.fromPlatform()).version;
    } catch (_) {}
    await _local.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('ic_stat_notify'),
        iOS: DarwinInitializationSettings(requestAlertPermission: false, requestBadgePermission: false, requestSoundPermission: false),
      ),
      onDidReceiveNotificationResponse: (response) => _openPayload(response.payload),
    );
    await _createChannels(_ref.read(langProvider));
    final launch = await _local.getNotificationAppLaunchDetails();
    if (launch?.didNotificationLaunchApp ?? false) _openPayload(launch?.notificationResponse?.payload);

    try {
      await Firebase.initializeApp();
      _firebase = true;
    } catch (_) {
      // No Firebase files in this build: popups come from the live connection instead.
    }
    if (_firebase) {
      final messaging = FirebaseMessaging.instance;
      FirebaseMessaging.onMessage.listen(_onForegroundMessage);
      FirebaseMessaging.onMessageOpenedApp.listen((message) => _open(message.data));
      final initial = await messaging.getInitialMessage();
      if (initial != null) _open(initial.data);
      // The server sends with FCM HTTP v1's message.token, which takes these registration tokens (the
      // newer register()/onRegistered gives an installation id for FID direct-send instead).
      // ignore: deprecated_member_use
      messaging.onTokenRefresh.listen((_) => unawaited(syncDevice()));
      if (Platform.isIOS) await messaging.setForegroundNotificationPresentationOptions(alert: false, badge: true, sound: false);
    }

    _ref.read(sessionProvider.notifier).beforeSignOut = forgetDevice;
    _ref.listen(customerIdProvider, (previous, next) {
      if (next != null && next != previous) unawaited(syncDevice());
    }, fireImmediately: true);
    _ref.listen(langProvider, (_, lang) {
      unawaited(_createChannels(lang));
      unawaited(syncDevice());
    });
  }

  /// Both channels pop up (heads-up). Names follow the app's language; customers can tune each in the
  /// phone's settings. The ids are the ones the server's FCM messages name (orders, news).
  Future<void> _createChannels(Lang lang) async {
    final l = L10n(lang);
    await _android?.createNotificationChannel(
      AndroidNotificationChannel(
        'orders',
        l.t('অর্ডারের খবর', 'Order updates'),
        description: l.t('দাম জানানো, বুকিং আর ডেলিভারির প্রতিটি ধাপ।', 'Prices, bookings and every step of a delivery.'),
        importance: Importance.max,
      ),
    );
    await _android?.createNotificationChannel(
      AndroidNotificationChannel(
        'news',
        l.t('অফার ও ঘোষণা', 'Offers and announcements'),
        description: l.t('আজকের অফার আর আমাদের ঘোষণা।', "Today's offers and our announcements."),
        importance: Importance.high,
      ),
    );
  }

  Future<bool> _turnedOff() async => (await SharedPreferences.getInstance()).getBool(_offKey) ?? false;

  /// Whether the phone lets the app show notifications.
  Future<bool> _allowed() async {
    if (Platform.isAndroid) return await _android?.areNotificationsEnabled() ?? false;
    if (_firebase) {
      final settings = await FirebaseMessaging.instance.getNotificationSettings();
      return settings.authorizationStatus == AuthorizationStatus.authorized || settings.authorizationStatus == AuthorizationStatus.provisional;
    }
    final ios = _local.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>();
    return (await ios?.checkPermissions())?.isEnabled ?? false;
  }

  Future<PushStatus> status() async {
    final allowed = await _allowed();
    if (await _turnedOff()) return PushStatus.off;
    if (allowed) return PushStatus.on;
    final asked = (await SharedPreferences.getInstance()).getBool(_askedKey) ?? false;
    return asked ? PushStatus.blocked : PushStatus.off;
  }

  /// Asks the phone (Android 13+, iOS), then registers it with the server. True when popups are on.
  Future<bool> turnOn() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_askedKey, true);
    await prefs.setBool(_offKey, false);
    var allowed = await _allowed();
    if (!allowed) {
      if (Platform.isAndroid) {
        allowed = await _android?.requestNotificationsPermission() ?? false;
      } else if (_firebase) {
        final settings = await FirebaseMessaging.instance.requestPermission(alert: true, badge: true, sound: true);
        allowed = settings.authorizationStatus == AuthorizationStatus.authorized || settings.authorizationStatus == AuthorizationStatus.provisional;
      } else {
        final ios = _local.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>();
        allowed = await ios?.requestPermissions(alert: true, badge: true, sound: true) ?? false;
      }
    }
    if (allowed) await syncDevice();
    _ref.invalidate(pushStatusProvider);
    return allowed;
  }

  /// The customer turns popups off for this phone: the server stops pushing to it.
  Future<void> turnOff() async {
    await (await SharedPreferences.getInstance()).setBool(_offKey, true);
    await forgetDevice();
    _ref.invalidate(pushStatusProvider);
  }

  Future<void> openSettings() async {
    if (Platform.isAndroid) {
      await _android?.openAppNotificationSettings();
    }
  }

  /// Tells the server this phone's FCM token (in the app's language) while popups are on. Runs after
  /// sign-in, on a new token and on a language change.
  Future<void> syncDevice() async {
    if (!_firebase || _ref.read(customerIdProvider) == null) return;
    if (await _turnedOff() || !await _allowed()) return;
    try {
      // ignore: deprecated_member_use
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) return;
      await _ref.read(apiProvider).registerDevice(token: token, platform: Platform.isIOS ? 'ios' : 'android', lang: _ref.read(langProvider), appVersion: _version);
      _token = token;
    } catch (_) {
      // Tried again on the next launch, sign-in or language change.
    }
  }

  /// Before signing out or turning popups off: this phone stops getting the customer's notifications.
  Future<void> forgetDevice() async {
    final token = _token;
    _token = null;
    if (token != null) {
      try {
        await _ref.read(apiProvider).removeDevice(token);
      } catch (_) {}
    }
    if (_firebase) {
      try {
        // ignore: deprecated_member_use
        await FirebaseMessaging.instance.deleteToken();
      } catch (_) {}
    }
    await _local.cancelAll();
  }

  /// A notification from the live connection: shown here unless FCM brings it.
  Future<void> showFromSocket(AppNotification notification) async {
    if (fcmActive || await _turnedOff() || !await _allowed()) return;
    final lang = _ref.read(langProvider);
    await _show(
      id: notification.id,
      type: notification.type,
      title: notification.title.of(lang),
      body: notification.body.of(lang),
      orderId: notification.orderId,
      offerId: notification.offerId,
    );
  }

  /// FCM while the app is open (the phone doesn't show those itself).
  Future<void> _onForegroundMessage(RemoteMessage message) async {
    final data = message.data;
    await _show(
      id: '${data['notificationId'] ?? message.messageId ?? DateTime.now().microsecondsSinceEpoch}',
      type: '${data['type'] ?? ''}',
      title: message.notification?.title ?? '',
      body: message.notification?.body ?? '',
      orderId: data['orderId'] as String?,
      offerId: data['offerId'] as String?,
    );
  }

  Future<void> _show({required String id, required String type, required String title, required String body, String? orderId, String? offerId}) async {
    if (!_shown.add(id)) return;
    if (_shown.length > 200) _shown.remove(_shown.first);
    final isOrder = type.startsWith('ORDER_');
    // The tag matches the server's FCM tag, so a newer message about the same order replaces this one.
    final tag = orderId != null ? 'order-$orderId' : (offerId != null ? 'offer-$offerId' : 'notification-$id');
    final l = L10n(_ref.read(langProvider));
    await _local.show(
      id: Platform.isAndroid ? 0 : tag.hashCode & 0x7fffffff,
      title: title,
      body: body,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          isOrder ? 'orders' : 'news',
          isOrder ? l.t('অর্ডারের খবর', 'Order updates') : l.t('অফার ও ঘোষণা', 'Offers and announcements'),
          importance: isOrder ? Importance.max : Importance.high,
          priority: Priority.high,
          icon: 'ic_stat_notify',
          color: Kf.blue,
          styleInformation: BigTextStyleInformation(body),
          tag: tag,
        ),
        iOS: DarwinNotificationDetails(threadIdentifier: tag),
      ),
      payload: jsonEncode({'notificationId': id, 'orderId': ?orderId, 'offerId': ?offerId}),
    );
  }

  void _openPayload(String? payload) {
    if (payload == null) return;
    try {
      _open(jsonDecode(payload) as Map<String, dynamic>);
    } catch (_) {}
  }

  /// A tapped notification: marked read, then its order, the offers, or the notification list.
  void _open(Map<String, dynamic> data) {
    final id = data['notificationId'];
    if (id is String && _ref.read(customerIdProvider) != null) {
      unawaited(_ref.read(apiProvider).markRead(id).then((_) => _ref.invalidate(unreadCountProvider), onError: (_) {}));
    }
    final orderId = data['orderId'];
    final route = orderId is String ? '/orders/${Uri.encodeComponent(orderId)}' : (data['offerId'] is String ? '/offers' : '/notifications');
    final router = appRouter;
    if (router != null && _ref.read(customerIdProvider) != null) {
      router.push(route);
    } else {
      pendingRoute = route;
    }
  }

  /// After the first order: offer popups so the price arrives on the phone (asked once).
  Future<void> offerAfterOrder() async {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(_askedKey) ?? false) return;
    if (await _allowed() && !await _turnedOff()) {
      await syncDevice();
      return;
    }
    final context = rootNavigatorKey.currentContext;
    if (context == null || !context.mounted) return;
    await showModalBottomSheet<void>(context: context, builder: (_) => const PushOfferSheet());
    await prefs.setBool(_askedKey, true);
  }
}

final pushProvider = Provider<PushService>((ref) => PushService(ref));

final pushStatusProvider = FutureProvider.autoDispose<PushStatus>((ref) => ref.read(pushProvider).status());

/// "Turn on phone notifications to hear the moment your price is ready."
class PushOfferSheet extends ConsumerWidget {
  const PushOfferSheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 56,
                height: 56,
                decoration: const BoxDecoration(color: Kf.blueSoft, shape: BoxShape.circle),
                child: const Icon(LucideIcons.bellRing, color: Kf.blue),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              l.t('দাম এলেই ফোনে জানুন', 'Know the moment your price arrives'),
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              l.t('দাম জানালেই ফোনে নোটিফিকেশন পেতে চালু করুন।', 'Turn on phone notifications to hear the moment your price is ready.'),
              textAlign: TextAlign.center,
              style: const TextStyle(color: Kf.ink2, height: 1.55),
            ),
            const SizedBox(height: 18),
            PrimaryButton(
              label: l.t('চালু করুন', 'Turn on'),
              icon: LucideIcons.bellRing,
              onPressed: () async {
                await ref.read(pushProvider).turnOn();
                if (context.mounted) Navigator.of(context).pop();
              },
            ),
            const SizedBox(height: 8),
            TextButton(onPressed: () => Navigator.of(context).pop(), child: Text(l.t('এখন না', 'Not now'))),
          ],
        ),
      ),
    );
  }
}
