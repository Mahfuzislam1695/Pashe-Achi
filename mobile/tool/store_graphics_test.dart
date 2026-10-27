// Draws Google Play's feature graphic (1024×500) with the app's real fonts and logo:
//   flutter test tool/store_graphics_test.dart
// It writes store/feature-graphic.png. Not part of the normal test run (that is test/).
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kingfisher/core/domain.dart';
import 'package:kingfisher/ui/theme.dart';
import 'package:material_ui/material_ui.dart';

Future<void> _loadFont(String family, List<String> assets) async {
  final loader = FontLoader(family);
  for (final asset in assets) {
    loader.addFont(rootBundle.load(asset));
  }
  await loader.load();
}

class FeatureGraphic extends StatelessWidget {
  const FeatureGraphic({super.key});

  @override
  Widget build(BuildContext context) {
    const bangla = TextStyle(fontFamily: 'HindSiliguri', letterSpacing: 0, color: Colors.white);
    return Container(
      width: 1024,
      height: 500,
      decoration: const BoxDecoration(
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Kf.navy, Color(0xFF13306E)]),
      ),
      child: Stack(
        children: [
          // The logo's colours as one band along the bottom.
          const Positioned(left: 0, right: 0, bottom: 0, height: 10, child: DecoratedBox(decoration: BoxDecoration(gradient: Kf.brandGradient))),
          Padding(
            padding: const EdgeInsets.fromLTRB(56, 48, 40, 58),
            child: Row(
              children: [
                Container(
                  width: 300,
                  height: 300,
                  padding: const EdgeInsets.all(26),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(color: Kf.teal.withValues(alpha: 0.45), width: 10),
                  ),
                  child: Image.asset('assets/logo/logo-512.webp'),
                ),
                const SizedBox(width: 48),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('কিংফিশার', style: bangla.copyWith(fontSize: 76, fontWeight: FontWeight.w700, height: 1.15)),
                      const Text('Kingfisher', style: TextStyle(fontFamily: 'Inter', fontSize: 30, fontWeight: FontWeight.w600, color: Kf.onNavy, height: 1.2)),
                      const SizedBox(height: 18),
                      Text('উন্নত জীবনের – সহজ সমাধান', style: bangla.copyWith(fontSize: 31, fontWeight: FontWeight.w500, height: 1.3)),
                      const SizedBox(height: 26),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final service in ServiceId.values)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                              decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(999)),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Container(width: 10, height: 10, decoration: BoxDecoration(color: ServiceTone.of(service).line, shape: BoxShape.circle)),
                                  const SizedBox(width: 7),
                                  Text(service.label.bn, style: bangla.copyWith(fontSize: 17, fontWeight: FontWeight.w600)),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

void main() {
  testWidgets('writes store/feature-graphic.png', (tester) async {
    await _loadFont('HindSiliguri', ['assets/fonts/HindSiliguri-Medium.ttf', 'assets/fonts/HindSiliguri-SemiBold.ttf', 'assets/fonts/HindSiliguri-Bold.ttf']);
    await _loadFont('Inter', ['assets/fonts/Inter-SemiBold.ttf']);
    tester.view.physicalSize = const Size(1024, 500);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final boundary = GlobalKey();
    await tester.pumpWidget(Directionality(textDirection: TextDirection.ltr, child: RepaintBoundary(key: boundary, child: const FeatureGraphic())));
    await tester.runAsync(() async {
      final element = tester.element(find.byType(FeatureGraphic));
      await precacheImage(const AssetImage('assets/logo/logo-512.webp'), element);
    });
    await tester.pump();
    await tester.runAsync(() async {
      final render = boundary.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      final image = await render.toImage(pixelRatio: 1);
      final png = await image.toByteData(format: ui.ImageByteFormat.png);
      File('store/feature-graphic.png').writeAsBytesSync(png!.buffer.asUint8List());
    });
    expect(File('store/feature-graphic.png').existsSync(), isTrue);
  });
}
