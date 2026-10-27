// The app's API client against a real server, from sign-up to account deletion. Never run against
// production: it creates and deletes a customer and sends prices as a manager.
//
//   (in the project folder) a throwaway database with `npm run db:seed` and `npm run db:seed:demo`,
//   the server on it, then here:
//   $env:KF_API = 'http://localhost:3100/api/v1'; flutter test test/contract_test.dart
@Tags(['contract'])
library;

import 'dart:async';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kingfisher/core/api.dart';
import 'package:kingfisher/core/domain.dart';
import 'package:kingfisher/core/format.dart';
import 'package:kingfisher/core/i18n.dart';
import 'package:kingfisher/core/models.dart';
import 'package:kingfisher/core/validation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

/// Tokens in memory (the phone's encrypted storage isn't there in a test).
class MemoryTokens extends TokenStore {
  @override
  Future<void> load() async {}

  @override
  Future<void> save(AuthTokens tokens) async {
    access = tokens.accessToken;
    refresh = tokens.refreshToken;
  }

  @override
  Future<void> clear() async => access = refresh = null;
}

void main() {
  final base = Platform.environment['KF_API'];
  if (base == null || base.contains('kingfisherbd24.com')) {
    test('contract (set KF_API to a local server to run)', () {}, skip: 'KF_API is not set to a local server');
    return;
  }

  final tokens = MemoryTokens();
  final ended = <String>[];
  final api = Api(tokens, onSessionEnded: ended.add, onCustomer: (_) {}, dio: Dio(BaseOptions(baseUrl: base)));
  final staff = Dio(BaseOptions(baseUrl: base));
  final mobile = '017${Random().nextInt(90000000) + 10000000}';
  const place = Place(address: 'উত্তরা, ঢাকা', details: 'বাসা ১২', pin: GeoPoint(23.8759, 90.3795));
  final tomorrow = Schedule(date: isoDate(nowInDhaka().add(const Duration(days: 1))), time: '10:30');

  test('public data parses', () async {
    final catalog = await api.catalog();
    expect(catalog.vehicles, isNotEmpty);
    expect(catalog.pricing.bazarDeliveryFee, greaterThanOrEqualTo(0));
    expect(catalog.deliveryHours.keys, containsAll(ServiceId.values));
    await api.offers();
  });

  test('sign up, profile and location', () async {
    final result = await api.signup(name: 'Contract Test', mobile: mobile, location: place, lang: Lang.en);
    await tokens.save(result.tokens);
    expect(result.user.mobile, mobile);
    expect(result.user.location?.details, 'বাসা ১২');
    final me = await api.updateProfile(name: 'Contract টেস্ট', mobile: mobile, lang: Lang.bn);
    expect([me.name, me.lang], ['Contract টেস্ট', Lang.bn]);
    final moved = await api.setLocation(const Place(address: 'মিরপুর ১০, ঢাকা', pin: GeoPoint(23.8069, 90.3687)));
    expect(moved.location?.address, 'মিরপুর ১০, ঢাকা');
  });

  late OrderDetail bazar;
  test('the four orders, and a prescription', () async {
    bazar = await api.createBazar(place: place, contactMobile: mobile, schedule: tomorrow, items: const [{'name': 'চাল', 'quantity': '5 কেজি'}, {'name': 'ডাল', 'quantity': '1 কেজি', 'variety': 'মসুর'}]);
    expect([bazar.status, bazar.code.startsWith('PA-'), bazar.items.length], [OrderStatus.pending, true, 2]);
    expect(isAwaitingPrice(bazar.service, bazar.status), isTrue);

    final png = Uint8List.fromList([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);
    final upload = await api.uploadPrescription(png, 'rx.png');
    final medicine = await api.createMedicine(place: place, contactMobile: mobile, schedule: tomorrow, prescriptionUploadId: upload.id, items: const []);
    expect(medicine.prescription?.id, upload.id);
    expect(await api.prescriptionBytes(upload.id), png);

    final vehicle = (await api.catalog()).vehicles.first;
    final shifting = await api.createShifting(loading: place, unloading: place, schedule: tomorrow, vehicleId: vehicle.id, labourers: 2, loadingFloor: 3, unloadingFloor: 1);
    expect(shifting.shifting?.vehicleRate, isNull);
    final parcel = await api.createParcel(product: 'বই', weight: '২ কেজি', pickup: place, dropoff: place, receiverMobile: '01711111111', schedule: tomorrow);
    expect(parcel.parcel?.product, 'বই');

    for (final order in [medicine, shifting, parcel]) {
      expect((await api.cancelOrder(order.id)).status, OrderStatus.cancelled);
    }
    final page = await api.orders();
    expect(page.items.map((o) => o.id), contains(bazar.id));
  });

  test('a price arrives on the socket and is confirmed as seen', () async {
    final arrived = Completer<AppNotification>();
    final socket = io.io(
      '${Uri.parse(base).origin}/ws',
      io.OptionBuilder().setTransports(['websocket']).setAuth({'token': tokens.access}).disableAutoConnect().enableForceNew().build(),
    );
    socket.on('notification:new', (data) {
      if (!arrived.isCompleted) arrived.complete(AppNotification.fromJson(Map<String, dynamic>.from(data as Map)));
    });
    final connected = Completer<void>();
    socket.onConnect((_) => connected.complete());
    socket.connect();
    await connected.future.timeout(const Duration(seconds: 10));

    final login = await staff.post<Map<String, dynamic>>('/admin/auth/login', data: {'mobile': '01822222222', 'password': 'demo1234'});
    final staffToken = (login.data!['tokens'] as Map)['accessToken'] as String;
    await staff.put<dynamic>(
      '/admin/orders/${bazar.id}/quote',
      data: {
        'items': [for (final item in bazar.items) {'id': item.id, 'name': item.name, 'quantity': item.quantity, 'price': 100}],
        'note': 'Contract test price',
      },
      options: Options(headers: {'authorization': 'Bearer $staffToken'}),
    );

    final notification = await arrived.future.timeout(const Duration(seconds: 10));
    socket.dispose();
    expect([notification.type, notification.orderId], ['ORDER_BILL', bazar.id]);

    final quoted = await api.order(bazar.id);
    expect([quoted.status, quoted.canConfirm, quoted.quoteVersion, quoted.quoteNote], [OrderStatus.quoted, true, 1, 'Contract test price']);
    await expectLater(api.confirmOrder(bazar.id, total: quoted.total, quoteVersion: 0), throwsA(isA<ApiError>().having((e) => e.code, 'code', 'order.quote_changed')));
    final booked = await api.confirmOrder(bazar.id, total: quoted.total, quoteVersion: quoted.quoteVersion);
    expect(booked.status, OrderStatus.booked);
  });

  test('notifications, the bell and the phone', () async {
    final page = await api.notifications();
    expect(page.items, isNotEmpty);
    expect(await api.unreadCount(), greaterThan(0));
    await api.markRead(page.items.first.id);
    await api.markAllRead();
    expect(await api.unreadCount(), 0);
    await api.registerDevice(token: 'contract-${DateTime.now().millisecondsSinceEpoch}:APA91b${'x' * 120}', platform: 'android', lang: Lang.bn, appVersion: '1.0.0+1');
  });

  test('an expired access token is refreshed once, transparently', () async {
    final oldRefresh = tokens.refresh;
    tokens.access = 'expired';
    final me = await api.me();
    expect(me.mobile, mobile);
    expect(tokens.refresh, isNot(oldRefresh));
    expect(ended, isEmpty);
  });

  test('deleting the account waits for running orders, then signs out everywhere', () async {
    await expectLater(api.deleteAccount(), throwsA(isA<ApiError>().having((e) => e.code, 'code', 'account.active_orders')));
    final login = await staff.post<Map<String, dynamic>>('/admin/auth/login', data: {'mobile': '01822222222', 'password': 'demo1234'});
    final staffToken = (login.data!['tokens'] as Map)['accessToken'] as String;
    await staff.patch<dynamic>('/admin/orders/${bazar.id}/status', data: {'status': 'COMPLETED'}, options: Options(headers: {'authorization': 'Bearer $staffToken'}));
    await api.deleteAccount();
    await expectLater(api.me(), throwsA(isA<ApiError>()));
    expect(ended, contains('auth.required'));
  });
}
