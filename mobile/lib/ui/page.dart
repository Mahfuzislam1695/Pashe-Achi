import 'package:material_ui/material_ui.dart';

import 'theme.dart';
import 'widgets.dart';

/// Room under a pushed screen's content for the Chat/Call dock.
const pageBottomSpace = 96.0;

/// A screen opened on top of the services (orders, notifications, offers, profile): a back arrow
/// and a title, the content, and Chat/Call at the bottom.
class PageScaffold extends StatelessWidget {
  const PageScaffold({super.key, required this.title, this.subtitle, required this.body, this.actions});

  final String title;
  final String? subtitle;
  final Widget body;
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: subtitle == null
            ? Text(title)
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title),
                  Text(subtitle!, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Kf.muted)),
                ],
              ),
        actions: actions,
      ),
      body: Stack(
        children: [
          Positioned.fill(child: body),
          if (!keyboardOpen(context))
            Positioned(left: 0, right: 0, bottom: 16 + MediaQuery.paddingOf(context).bottom, child: const Center(child: ContactDock())),
        ],
      ),
    );
  }
}

/// Content padding for a pushed screen's list, centred and at most 640 wide on big screens.
EdgeInsets pagePadding(BuildContext context) {
  final width = MediaQuery.sizeOf(context).width;
  final side = width > 700 ? (width - 640) / 2 : Kf.gutter(context);
  return EdgeInsets.fromLTRB(side, 16, side, pageBottomSpace + MediaQuery.paddingOf(context).bottom);
}
