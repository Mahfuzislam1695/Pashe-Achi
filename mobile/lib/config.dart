/// Where the app finds the server, and the few fixed addresses it opens.
///
/// Release builds use the live site. A debug build can point at a server on the computer
/// (the Android emulator reaches it as 10.0.2.2):
///   flutter run --dart-define=API_BASE=http://10.0.2.2:3000/api/v1
abstract final class AppConfig {
  static const apiBase = String.fromEnvironment('API_BASE', defaultValue: 'https://kingfisherbd24.com/api/v1');

  /// The site the API lives on (https://kingfisherbd24.com): offer pictures, Socket.IO and the policy pages.
  static final String origin = Uri.parse(apiBase).origin;

  /// Socket.IO namespace /ws on the same server (src/server/notifications/notifications.gateway.ts).
  static final String socketUrl = '$origin/ws';

  static final String privacyUrl = '$origin/privacy';
  static final String accountDeletionUrl = '$origin/account-deletion';

  /// Must match the Android applicationId and iOS bundle id; OpenStreetMap identifies the app by it.
  static const applicationId = 'com.kingfisherbd24.app';

  /// OpenStreetMap's own tiles, as on the website (allowed with the app's id, attribution and
  /// flutter_map's built-in cache). One line to change for a paid tile host if traffic grows.
  static const tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  /// The developer credit (src/shared/brand.ts DEVELOPER).
  static const developerName = 'Aethrasoft';
  static const developerUrl = 'https://www.aethrasoft.com/';
}
