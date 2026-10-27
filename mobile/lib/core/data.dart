import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'models.dart';
import 'session.dart';

/// Prices, vehicles, the support line, delivery hours and the password switch (public).
final catalogProvider = FutureProvider<Catalog>((ref) => ref.watch(apiProvider).catalog());

/// Today's running offers (public).
final offersProvider = FutureProvider<List<Offer>>((ref) => ref.watch(apiProvider).offers());

/// One order, fresh from the server (the socket's order:updated refreshes it).
final orderProvider = FutureProvider.autoDispose.family<OrderDetail, String>((ref, id) {
  ref.watch(customerIdProvider);
  return ref.watch(apiProvider).order(id);
});

/// A list the API pages with a cursor, loaded 20 at a time.
class PagedList<T> {
  const PagedList(this.items, this.nextCursor, {this.loadingMore = false, this.moreFailed = false});

  final List<T> items;
  final String? nextCursor;
  final bool loadingMore;
  final bool moreFailed;

  bool get hasMore => nextCursor != null;
}

abstract class PagedNotifier<T> extends AsyncNotifier<PagedList<T>> {
  Future<CursorPage<T>> fetch(String? cursor);

  @override
  Future<PagedList<T>> build() async {
    // A different customer starts a fresh list.
    ref.watch(customerIdProvider);
    final page = await fetch(null);
    return PagedList(page.items, page.nextCursor);
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore || current.loadingMore) return;
    state = AsyncData(PagedList(current.items, current.nextCursor, loadingMore: true));
    try {
      final page = await fetch(current.nextCursor);
      state = AsyncData(PagedList([...current.items, ...page.items], page.nextCursor));
    } catch (_) {
      state = AsyncData(PagedList(current.items, current.nextCursor, moreFailed: true));
    }
  }
}

class OrdersNotifier extends PagedNotifier<OrderSummary> {
  @override
  Future<CursorPage<OrderSummary>> fetch(String? cursor) => ref.read(apiProvider).orders(cursor: cursor);
}

final ordersProvider = AsyncNotifierProvider<OrdersNotifier, PagedList<OrderSummary>>(OrdersNotifier.new);

class NotificationsNotifier extends PagedNotifier<AppNotification> {
  @override
  Future<CursorPage<AppNotification>> fetch(String? cursor) => ref.read(apiProvider).notifications(cursor: cursor);

  /// Marks one read on screen at once; the server is told in the background.
  void markReadLocally(String id) {
    final current = state.value;
    if (current == null) return;
    state = AsyncData(
      PagedList([for (final n in current.items) n.id == id ? n.markedRead() : n], current.nextCursor, loadingMore: current.loadingMore, moreFailed: current.moreFailed),
    );
  }
}

final notificationsProvider = AsyncNotifierProvider<NotificationsNotifier, PagedList<AppNotification>>(NotificationsNotifier.new);

/// The bell's count: refreshed from the server, nudged locally as notifications arrive or are read.
class UnreadCountNotifier extends AsyncNotifier<int> {
  @override
  Future<int> build() async {
    if (ref.watch(customerIdProvider) == null) return 0;
    return ref.read(apiProvider).unreadCount();
  }

  void add(int delta) {
    final current = state.value;
    if (current != null) state = AsyncData((current + delta).clamp(0, 1 << 30));
  }
}

final unreadCountProvider = AsyncNotifierProvider<UnreadCountNotifier, int>(UnreadCountNotifier.new);
