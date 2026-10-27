import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../config.dart';
import 'data.dart';
import 'models.dart';
import 'notifications.dart';
import 'session.dart';

/// The live connection (Socket.IO, namespace /ws) while a customer is signed in: new notifications
/// bump the bell and pop up; order changes refresh the lists and the open order.
class Realtime {
  Realtime(this._ref);

  final Ref _ref;
  io.Socket? _socket;
  int _authFailures = 0;

  bool get connected => _socket?.connected ?? false;

  void connect() {
    if (_socket != null) return;
    final tokens = _ref.read(tokenStoreProvider);
    final socket = io.io(
      AppConfig.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          // Read on every (re)connect, so a refreshed token is used.
          .setAuthFn((callback) => callback({'token': tokens.access ?? ''}))
          .disableAutoConnect()
          .enableForceNew()
          .enableReconnection()
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(10000)
          .build(),
    );
    socket.onConnect((_) {
      _authFailures = 0;
      _ref.invalidate(unreadCountProvider);
      _ref.invalidate(notificationsProvider);
    });
    // A refused handshake (expired token) isn't retried by Socket.IO: refresh, then connect again.
    socket.onConnectError((error) {
      if ('$error'.contains('unauthorized') && _authFailures++ < 3) {
        unawaited(
          _ref.read(apiProvider).refresh().then((ok) {
            if (ok && identical(_socket, socket)) socket.connect();
          }, onError: (_) {}),
        );
      }
    });
    socket.on('notification:new', (data) {
      if (data is! Map) return;
      final notification = AppNotification.fromJson(Map<String, dynamic>.from(data));
      _ref.read(unreadCountProvider.notifier).add(1);
      _ref.invalidate(notificationsProvider);
      if (notification.type == 'OFFER') _ref.invalidate(offersProvider);
      unawaited(_ref.read(pushProvider).showFromSocket(notification));
    });
    socket.on('order:updated', (data) {
      _ref.invalidate(ordersProvider);
      final id = data is Map ? data['id'] : null;
      if (id is String) _ref.invalidate(orderProvider(id));
    });
    socket.connect();
    _socket = socket;
  }

  void disconnect() {
    _socket?.dispose();
    _socket = null;
  }

  /// Back from the background: reconnect if the phone dropped the connection.
  void resume() {
    final socket = _socket;
    if (socket != null && !socket.connected) socket.connect();
  }
}

final realtimeProvider = Provider<Realtime>((ref) {
  final realtime = Realtime(ref);
  ref.listen(customerIdProvider, (previous, next) {
    if (next != previous) realtime.disconnect();
    if (next != null) realtime.connect();
  }, fireImmediately: true);
  ref.onDispose(realtime.disconnect);
  return realtime;
});
