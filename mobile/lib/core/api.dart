import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config.dart';
import 'i18n.dart';
import 'messages.dart';
import 'models.dart';
import 'validation.dart';

/// A failed request, as the API reports it ({ statusCode, code, message, issues }), or code
/// `network` when the server could not be reached.
class ApiError implements Exception {
  ApiError(this.status, this.code, {this.message, this.issueCodes = const []});

  final int status;
  final String code;
  final Bilingual? message;
  final List<String> issueCodes;

  bool get isNetwork => status == 0;

  /// The one code a form shows: its field issues in the form's order, otherwise the code.
  String codeFor([List<String> priority = const []]) => issueCodes.isNotEmpty ? pickIssueCode(issueCodes, priority) : code;

  /// The text to show: the app's own wording for known codes, otherwise the server's.
  String textFor(L10n l, [List<String> priority = const []]) {
    final picked = codeFor(priority);
    if (isMessageCode(picked)) return l.text(messageText(picked));
    return message != null ? l.text(message!) : l.text(messageText('server'));
  }

  @override
  String toString() => 'ApiError($status, $code)';
}

/// The code to show for any failure: an ApiError's (in the form's order), otherwise "server".
String errorCode(Object error, [List<String> priority = const []]) => error is ApiError ? error.codeFor(priority) : 'server';

/// The session tokens, in the phone's encrypted storage (Android Keystore, iOS Keychain).
class TokenStore {
  TokenStore([FlutterSecureStorage? storage]) : _storage = storage ?? const FlutterSecureStorage();

  static const _accessKey = 'access_token';
  static const _refreshKey = 'refresh_token';

  final FlutterSecureStorage _storage;
  String? access;
  String? refresh;

  Future<void> load() async {
    try {
      access = await _storage.read(key: _accessKey);
      refresh = await _storage.read(key: _refreshKey);
    } catch (_) {
      // Unreadable (e.g. restored onto a new phone): start signed out.
      access = refresh = null;
    }
  }

  /// The refresh token rotates on every use, so the new pair is saved before anything uses it.
  Future<void> save(AuthTokens tokens) async {
    access = tokens.accessToken;
    refresh = tokens.refreshToken;
    await _storage.write(key: _accessKey, value: tokens.accessToken);
    await _storage.write(key: _refreshKey, value: tokens.refreshToken);
  }

  Future<void> clear() async {
    access = refresh = null;
    try {
      await _storage.delete(key: _accessKey);
      await _storage.delete(key: _refreshKey);
    } catch (_) {}
  }
}

/// The Kingfisher API (src/server) for a signed-in customer: `Authorization: Bearer <accessToken>`
/// on every request, and one shared refresh (`POST /auth/refresh {refreshToken}`) when a request
/// comes back 401. Network trouble and rate limits never sign anyone out; only a refused refresh
/// (401) or a blocked or deleted account does, through [onSessionEnded].
class Api {
  Api(this.tokens, {required this.onSessionEnded, required this.onCustomer, Dio? dio})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              baseUrl: AppConfig.apiBase,
              connectTimeout: const Duration(seconds: 15),
              receiveTimeout: const Duration(seconds: 30),
              sendTimeout: const Duration(seconds: 90),
              headers: {'accept': 'application/json'},
            ),
          );

  final TokenStore tokens;

  /// The session is over (code: auth.required, auth.blocked).
  final void Function(String code) onSessionEnded;

  /// A refresh returned the customer as the server has them now.
  final void Function(Customer customer) onCustomer;

  final Dio _dio;
  Future<bool>? _refreshing;

  Future<T> _send<T>(
    String method,
    String path, {
    Object? data,
    Map<String, dynamic>? query,
    bool retry = true,
    T Function(dynamic data)? parse,
    CancelToken? cancel,
    ProgressCallback? onSendProgress,
    ResponseType? responseType,
  }) async {
    try {
      final response = await _dio.request<dynamic>(
        path,
        data: data,
        queryParameters: query,
        cancelToken: cancel,
        onSendProgress: onSendProgress,
        options: Options(method: method, responseType: responseType, headers: {if (tokens.access != null) 'authorization': 'Bearer ${tokens.access}'}),
      );
      return parse == null ? response.data as T : parse(response.data);
    } on DioException catch (e) {
      if (e.type == DioExceptionType.cancel) rethrow;
      final error = _toApiError(e);
      // Sign-in calls answer 401 for a wrong password, so only /auth/me is retried among them.
      if (error.status == 401 && retry && (!path.startsWith('/auth/') || path == '/auth/me')) {
        if (await refresh()) {
          return _send(method, path, data: data, query: query, retry: false, parse: parse, cancel: cancel, onSendProgress: onSendProgress, responseType: responseType);
        }
        throw error;
      }
      if (error.status == 401 && !retry) _end('auth.required');
      if (error.status == 403 && error.code == 'auth.blocked') _end('auth.blocked');
      throw error;
    }
  }

  /// One refresh at a time: concurrent 401s wait for the same one. True when a new pair is saved.
  /// Network errors and 429 surface as an ApiError and keep the session.
  Future<bool> refresh() => _refreshing ??= _refresh().whenComplete(() => _refreshing = null);

  Future<bool> _refresh() async {
    final refreshToken = tokens.refresh;
    if (refreshToken == null) {
      _end('auth.required');
      return false;
    }
    try {
      final response = await _dio.post<dynamic>('/auth/refresh', data: {'refreshToken': refreshToken});
      final result = AuthResult.fromJson(response.data as Json);
      await tokens.save(result.tokens);
      onCustomer(result.user);
      return true;
    } on DioException catch (e) {
      final error = _toApiError(e);
      if (error.status == 401 || error.status == 403) {
        _end(error.code == 'auth.blocked' ? 'auth.blocked' : 'auth.required');
        return false;
      }
      throw error;
    }
  }

  void _end(String code) {
    unawaited(tokens.clear());
    onSessionEnded(code);
  }

  static ApiError _toApiError(DioException e) {
    final response = e.response;
    if (response == null) return ApiError(0, 'network');
    final status = response.statusCode ?? 0;
    final body = response.data;
    if (body is Map) {
      final code = body['code'] is String ? body['code'] as String : (status == 401 ? 'auth.required' : 'server');
      final issues = [
        for (final issue in (body['issues'] as List?) ?? const [])
          if (issue is Map && issue['code'] is String) issue['code'] as String,
      ];
      return ApiError(status, code, message: body['message'] is Map ? Bilingual.fromJson(body['message']) : null, issueCodes: issues);
    }
    return ApiError(status, status == 401 ? 'auth.required' : (status == 429 ? 'rate_limited' : 'server'));
  }

  // Auth (POST /auth/signup is 201, the others 200; tokens come in the body).

  Future<AuthResult> signup({required String name, required String mobile, required Place location, String? password, required Lang lang}) => _send(
    'POST',
    '/auth/signup',
    data: {'name': name, 'mobile': mobile, 'location': location.toJson(), 'password': ?password, 'lang': lang.name},
    parse: (d) => AuthResult.fromJson(d as Json),
  );

  Future<AuthResult> login({required String mobile, String? password}) =>
      _send('POST', '/auth/login', data: {'mobile': mobile, 'password': ?password}, parse: (d) => AuthResult.fromJson(d as Json));

  Future<void> logout() async {
    final refreshToken = tokens.refresh;
    await _send<void>('POST', '/auth/logout', data: {'refreshToken': ?refreshToken});
  }

  Future<Customer> me() => _send('GET', '/auth/me', parse: (d) => Customer.fromJson(d as Json));

  // Profile

  Future<Customer> updateProfile({required String name, required String mobile, required Lang lang}) =>
      _send('PATCH', '/me', data: {'name': name, 'mobile': mobile, 'lang': lang.name}, parse: (d) => Customer.fromJson(d as Json));

  Future<Customer> setLocation(Place place) => _send('PUT', '/me/location', data: place.toJson(), parse: (d) => Customer.fromJson(d as Json));

  /// Ends every session, this one included.
  Future<void> changePassword({required String current, required String next}) =>
      _send<void>('POST', '/me/password', data: {'currentPassword': current, 'newPassword': next});

  /// Refused (account.active_orders) while an order is running.
  Future<void> deleteAccount() => _send<void>('DELETE', '/me');

  // Public data

  Future<Catalog> catalog() => _send('GET', '/catalog', parse: (d) => Catalog.fromJson(d as Json));

  Future<List<Offer>> offers() => _send('GET', '/offers', parse: (d) => [for (final o in d as List) Offer.fromJson(o as Json)]);

  /// The address for a map pin, or null when the map has none (the customer then types the area).
  Future<String?> reverseGeocode(GeoPoint pin, Lang lang, {CancelToken? cancel}) => _send(
    'GET',
    '/geo/reverse',
    query: {'lat': pin.lat, 'lng': pin.lng, 'lang': lang.name},
    cancel: cancel,
    parse: (d) => (d as Json)['address'] as String?,
  );

  // Orders

  Future<CursorPage<OrderSummary>> orders({String? cursor}) => _send(
    'GET',
    '/orders',
    query: {'limit': 20, 'cursor': ?cursor},
    parse: (d) => CursorPage([for (final o in (d as Json)['items'] as List) OrderSummary.fromJson(o as Json)], d['nextCursor'] as String?),
  );

  Future<OrderDetail> order(String id) => _send('GET', '/orders/${Uri.encodeComponent(id)}', parse: (d) => OrderDetail.fromJson(d as Json));

  Future<OrderDetail> createBazar({required Place place, required String contactMobile, required Schedule schedule, required List<Map<String, String>> items}) => _send(
    'POST',
    '/orders/bazar',
    data: {'address': place.text, 'addressPin': place.pin.toJson(), 'contactMobile': contactMobile, 'schedule': schedule.toJson(), 'items': items},
    parse: (d) => OrderDetail.fromJson(d as Json),
  );

  Future<OrderDetail> createMedicine({
    required Place place,
    required String contactMobile,
    required Schedule schedule,
    String? prescriptionUploadId,
    required List<Map<String, String>> items,
  }) => _send(
    'POST',
    '/orders/medicine',
    data: {
      'address': place.text,
      'addressPin': place.pin.toJson(),
      'contactMobile': contactMobile,
      'schedule': schedule.toJson(),
      'prescriptionUploadId': ?prescriptionUploadId,
      'items': items,
    },
    parse: (d) => OrderDetail.fromJson(d as Json),
  );

  Future<OrderDetail> createShifting({
    required Place loading,
    required Place unloading,
    required Schedule schedule,
    required String vehicleId,
    required int labourers,
    required int loadingFloor,
    required int unloadingFloor,
  }) => _send(
    'POST',
    '/orders/shifting',
    data: {
      'loadingArea': loading.text,
      'unloadingArea': unloading.text,
      'loadingPin': loading.pin.toJson(),
      'unloadingPin': unloading.pin.toJson(),
      'schedule': schedule.toJson(),
      'vehicleId': vehicleId,
      'labourers': labourers,
      'loadingFloor': loadingFloor,
      'unloadingFloor': unloadingFloor,
    },
    parse: (d) => OrderDetail.fromJson(d as Json),
  );

  Future<OrderDetail> createParcel({
    required String product,
    String? weight,
    required Place pickup,
    required Place dropoff,
    required String receiverMobile,
    required Schedule schedule,
  }) => _send(
    'POST',
    '/orders/parcel',
    data: {
      'product': product,
      'weight': ?weight,
      'pickupAddress': pickup.text,
      'dropoffAddress': dropoff.text,
      'pickupPin': pickup.pin.toJson(),
      'dropoffPin': dropoff.pin.toJson(),
      'receiverMobile': receiverMobile,
      'schedule': schedule.toJson(),
    },
    parse: (d) => OrderDetail.fromJson(d as Json),
  );

  Future<OrderDetail> cancelOrder(String id) => _send('POST', '/orders/${Uri.encodeComponent(id)}/cancel', parse: (d) => OrderDetail.fromJson(d as Json));

  /// Confirms the price the customer saw: the server refuses (order.quote_changed) if it changed since.
  Future<OrderDetail> confirmOrder(String id, {required int total, required int quoteVersion}) => _send(
    'POST',
    '/orders/${Uri.encodeComponent(id)}/confirm',
    data: {'total': total, 'quoteVersion': quoteVersion},
    parse: (d) => OrderDetail.fromJson(d as Json),
  );

  // Prescriptions

  Future<UploadInfo> uploadPrescription(Uint8List bytes, String filename, {ProgressCallback? onProgress}) => _send(
    'POST',
    '/uploads/prescription',
    data: FormData.fromMap({'file': MultipartFile.fromBytes(bytes, filename: filename)}),
    onSendProgress: onProgress,
    parse: (d) => UploadInfo.fromJson(d as Json),
  );

  /// A prescription's bytes (the file needs the Bearer header, so it can't be opened as a plain link).
  Future<Uint8List> prescriptionBytes(String id) => _send(
    'GET',
    '/uploads/${Uri.encodeComponent(id)}',
    responseType: ResponseType.bytes,
    parse: (d) => Uint8List.fromList(d as List<int>),
  );

  // Notifications

  Future<CursorPage<AppNotification>> notifications({String? cursor}) => _send(
    'GET',
    '/notifications',
    query: {'limit': 20, 'cursor': ?cursor},
    parse: (d) => CursorPage([for (final n in (d as Json)['items'] as List) AppNotification.fromJson(n as Json)], d['nextCursor'] as String?),
  );

  Future<int> unreadCount() => _send('GET', '/notifications/unread-count', parse: (d) => ((d as Json)['count'] as num).round());

  Future<void> markRead(String id) => _send<void>('PATCH', '/notifications/${Uri.encodeComponent(id)}/read');

  Future<void> markAllRead() => _send<void>('POST', '/notifications/read-all');

  /// This phone's FCM token, so the customer's notifications pop up even when the app is closed.
  Future<void> registerDevice({required String token, required String platform, required Lang lang, String? appVersion}) =>
      _send<void>('PUT', '/notifications/device', data: {'token': token, 'platform': platform, 'lang': lang.name, 'appVersion': ?appVersion});

  Future<void> removeDevice(String token) => _send<void>('DELETE', '/notifications/device', data: {'token': token});
}
