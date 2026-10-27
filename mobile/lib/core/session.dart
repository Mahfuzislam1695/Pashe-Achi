import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api.dart';
import 'i18n.dart';
import 'models.dart';

/// Where the customer's session stands.
sealed class SessionState {
  const SessionState();
}

/// Reading the saved session at launch.
class SessionStarting extends SessionState {
  const SessionStarting();
}

/// A saved session exists, but the server couldn't be reached to check it. Nothing is lost: retry.
class SessionOffline extends SessionState {
  const SessionOffline();
}

class SignedOut extends SessionState {
  const SignedOut([this.reason]);

  /// Why the session ended, when it wasn't the customer's choice (auth.blocked, auth.required).
  final String? reason;
}

class SignedIn extends SessionState {
  const SignedIn(this.customer);

  final Customer customer;
}

final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());

final apiProvider = Provider<Api>((ref) {
  return Api(
    ref.watch(tokenStoreProvider),
    onSessionEnded: (code) => ref.read(sessionProvider.notifier).ended(code),
    onCustomer: (customer) => ref.read(sessionProvider.notifier).updateCustomer(customer),
  );
});

/// The signed-in customer, or the reason there is none. Customer sessions never expire on their
/// own: they end on logout, a password change, a block, an account deletion or a replayed token.
class SessionController extends Notifier<SessionState> {
  /// Runs before signing out (unregistering this phone from push); set by the push service.
  Future<void> Function()? beforeSignOut;

  @override
  SessionState build() => const SessionStarting();

  Api get _api => ref.read(apiProvider);

  /// At launch: no saved session → signed out; otherwise ask the server who this is.
  Future<void> restore() async {
    final tokens = ref.read(tokenStoreProvider);
    await tokens.load();
    if (tokens.refresh == null) {
      state = const SignedOut();
      return;
    }
    state = const SessionStarting();
    try {
      state = SignedIn(await _api.me());
    } on ApiError catch (e) {
      if (e.status == 401 || e.status == 403) {
        // Api has already ended the session.
        if (state is! SignedOut) state = SignedOut(e.code);
      } else {
        state = const SessionOffline();
      }
    }
  }

  Future<Customer> login({required String mobile, String? password}) async {
    final result = await _api.login(mobile: mobile, password: password);
    await ref.read(tokenStoreProvider).save(result.tokens);
    state = SignedIn(result.user);
    return result.user;
  }

  Future<Customer> signup({required String name, required String mobile, required Place location, String? password}) async {
    final result = await _api.signup(name: name, mobile: mobile, location: location, password: password, lang: ref.read(langProvider));
    await ref.read(tokenStoreProvider).save(result.tokens);
    state = SignedIn(result.user);
    return result.user;
  }

  void updateCustomer(Customer customer) {
    if (state is SignedIn) state = SignedIn(customer);
  }

  /// The customer signs out: this phone stops getting their notifications, then the session ends.
  Future<void> signOut() async {
    try {
      await beforeSignOut?.call();
    } catch (_) {}
    try {
      await _api.logout();
    } catch (_) {}
    await ref.read(tokenStoreProvider).clear();
    state = const SignedOut();
  }

  /// The server ended the session (or the account was deleted here).
  void ended(String code) {
    if (state is SignedOut) return;
    unawaited(ref.read(tokenStoreProvider).clear());
    state = SignedOut(code);
  }
}

final sessionProvider = NotifierProvider<SessionController, SessionState>(SessionController.new);

/// The signed-in customer (screens inside the signed-in shell can rely on it).
final customerProvider = Provider<Customer?>((ref) => switch (ref.watch(sessionProvider)) {
  SignedIn(:final customer) => customer,
  _ => null,
});

/// Changes only when a different customer signs in or out, so per-customer data resets then.
final customerIdProvider = Provider<String?>((ref) => ref.watch(customerProvider)?.id);
