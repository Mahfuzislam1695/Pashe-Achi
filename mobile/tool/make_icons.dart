// Makes the app's icon images from the website's logo (public/logo/logo.png, the kingfisher on a
// transparent background). Run from mobile/ after the logo changes:
//
//   dart run tool/make_icons.dart
//   dart run flutter_launcher_icons
//   dart run flutter_native_splash:create
//
// It writes assets/icon/ (inputs for the two generators), the Android notification icon, and the
// Play Store icon (store/icon-512.png).
import 'dart:io';
import 'dart:math';

import 'package:image/image.dart' as img;

void main() {
  final logo = File('../public/logo/logo.png');
  if (!logo.existsSync()) {
    stderr.writeln('Run this from mobile/: ../public/logo/logo.png was not found.');
    exit(1);
  }
  final bird = img.trim(img.decodePng(logo.readAsBytesSync())!.convert(numChannels: 4), mode: img.TrimMode.transparent);
  final white = img.ColorRgba8(255, 255, 255, 255);

  // Android adaptive icon: the launcher crops the 108dp layer to a shape, and only the middle 66dp
  // circle is always visible, so the bird stays well inside it.
  _write('assets/icon/icon-foreground.png', _onCanvas(bird, 1024, 0.56));
  // Android 13 themed icons tint this one-colour layer.
  _write('assets/icon/icon-monochrome.png', _silhouette(_onCanvas(bird, 1024, 0.56)));
  // iOS icons may not be transparent; iOS rounds the corners itself.
  _write('assets/icon/icon-ios.png', _onCanvas(bird, 1024, 0.74, background: white));
  // Launch screen: the bird alone (before Android 12), and inside the circle Android 12+ shows.
  _write('assets/icon/splash.png', _onCanvas(bird, 768, 0.86));
  _write('assets/icon/splash-android12.png', _onCanvas(bird, 960, 0.56));
  // Google Play's listing icon: 512×512, full square (Play rounds it).
  _write('store/icon-512.png', _onCanvas(bird, 512, 0.74, background: white));

  // The status-bar icon must be white on transparent, or Android shows a white square.
  const densities = {'mdpi': 24, 'hdpi': 36, 'xhdpi': 48, 'xxhdpi': 72, 'xxxhdpi': 96};
  final mark = _silhouette(_onCanvas(bird, 512, 0.9));
  densities.forEach((density, size) {
    final icon = img.copyResize(mark, width: size, height: size, interpolation: img.Interpolation.average);
    _write('android/app/src/main/res/drawable-$density/ic_stat_notify.png', icon);
  });
  stdout.writeln('Icons written.');
}

/// [logo] scaled so its longer side is [fill] of a [size]×[size] canvas, centred.
img.Image _onCanvas(img.Image logo, int size, double fill, {img.Color? background}) {
  final canvas = img.Image(width: size, height: size, numChannels: 4);
  if (background != null) img.fill(canvas, color: background);
  final scale = size * fill / max(logo.width, logo.height);
  final resized = img.copyResize(
    logo,
    width: (logo.width * scale).round(),
    height: (logo.height * scale).round(),
    interpolation: img.Interpolation.cubic,
  );
  return img.compositeImage(canvas, resized, dstX: (size - resized.width) ~/ 2, dstY: (size - resized.height) ~/ 2);
}

/// Every visible pixel turned white, keeping its transparency.
img.Image _silhouette(img.Image image) {
  final out = img.Image.from(image);
  for (final pixel in out) {
    pixel
      ..r = 255
      ..g = 255
      ..b = 255;
  }
  return out;
}

void _write(String path, img.Image image) {
  File(path)
    ..parent.createSync(recursive: true)
    ..writeAsBytesSync(img.encodePng(image));
}
