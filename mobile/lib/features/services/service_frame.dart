import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../ui/lucide.dart';
import '../../core/api.dart';
import '../../core/data.dart';
import '../../core/i18n.dart';
import '../../core/notifications.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

/// Room left under a screen's content for the floating bottom nav and the Chat/Call dock.
const shellBottomSpace = 176.0;

/// A service screen's page: one card with the form, then its bill and the send button (the
/// website's ServiceCard). Pull down to refresh the prices.
class ServiceFrame extends ConsumerWidget {
  const ServiceFrame({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final gutter = Kf.gutter(context);
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(catalogProvider);
        ref.invalidate(offersProvider);
        try {
          await ref.read(catalogProvider.future);
        } catch (_) {
          // The screens show the failure where the data is used.
        }
      },
      child: ListView(
        padding: EdgeInsets.fromLTRB(gutter, 18, gutter, shellBottomSpace + MediaQuery.paddingOf(context).bottom),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 640),
              child: SectionCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A text box bound to a draft value: it keeps its cursor while typing and follows the draft when
/// the form is reset.
class DraftTextField extends StatefulWidget {
  const DraftTextField({super.key, required this.value, required this.onChanged, this.hint, this.keyboardType, this.maxLength, this.autofillHints, this.textInputAction});

  final String value;
  final ValueChanged<String> onChanged;
  final String? hint;
  final TextInputType? keyboardType;
  final int? maxLength;
  final Iterable<String>? autofillHints;
  final TextInputAction? textInputAction;

  @override
  State<DraftTextField> createState() => _DraftTextFieldState();
}

class _DraftTextFieldState extends State<DraftTextField> {
  late final _controller = TextEditingController(text: widget.value);

  @override
  void didUpdateWidget(DraftTextField old) {
    super.didUpdateWidget(old);
    if (widget.value != _controller.text) _controller.text = widget.value;
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _controller,
      onChanged: widget.onChanged,
      keyboardType: widget.keyboardType,
      maxLength: widget.maxLength,
      autofillHints: widget.autofillHints,
      textInputAction: widget.textInputAction ?? TextInputAction.next,
      decoration: InputDecoration(hintText: widget.hint, counterText: ''),
    );
  }
}

/// The send button with the form's one message above it. Messages show only after the first tap,
/// then follow the form as it is filled (the website's behaviour).
class SendOrderButton extends ConsumerWidget {
  const SendOrderButton({super.key, required this.code, required this.busy, required this.onPressed, this.label});

  final String? code;
  final bool busy;
  final VoidCallback onPressed;
  final String? label;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(l10nProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (code != null) ...[FormErrorBox(code: code), const SizedBox(height: 10)],
        PrimaryButton(
          label: busy ? l.t('অপেক্ষা করুন…', 'Please wait…') : (label ?? l.t('অর্ডার পাঠান', 'Send order')),
          icon: LucideIcons.check,
          busy: busy,
          onPressed: () {
            // Close the keyboard so the message or the result shows, and so coming back from
            // Orders doesn't reopen it on the last box typed in.
            FocusManager.instance.primaryFocus?.unfocus();
            onPressed();
          },
        ),
      ],
    );
  }
}

/// After an order is placed: refresh the lists, say so, open Orders (as the website does), and
/// offer phone notifications so the price arrives as a popup.
Future<void> afterOrderPlaced(BuildContext context, WidgetRef ref) async {
  final l = ref.read(l10nProvider);
  ref.invalidate(ordersProvider);
  final messenger = ScaffoldMessenger.of(context);
  messenger.showSnackBar(SnackBar(content: Text(l.t('অর্ডার পাঠানো হয়েছে।', 'Order sent.'))));
  context.push('/orders');
  await ref.read(pushProvider).offerAfterOrder();
}

/// The code a failed send shows, in the form's order.
String sendErrorCode(Object error, List<String> priority) => errorCode(error, priority);
