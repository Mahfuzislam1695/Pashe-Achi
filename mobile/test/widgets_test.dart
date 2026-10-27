// The screens' rules that matter most, with the API replaced by a fake.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kingfisher/core/api.dart';
import 'package:kingfisher/core/data.dart';
import 'package:kingfisher/core/domain.dart';
import 'package:kingfisher/core/i18n.dart';
import 'package:kingfisher/core/models.dart';
import 'package:kingfisher/core/notifications.dart';
import 'package:kingfisher/core/session.dart';
import 'package:kingfisher/features/auth/auth_screens.dart';
import 'package:kingfisher/features/orders/order_detail_screen.dart';
import 'package:kingfisher/ui/forms.dart';
import 'package:kingfisher/ui/theme.dart';
import 'package:material_ui/material_ui.dart';

Catalog catalog({bool passwordOn = false}) => Catalog.fromJson({
  'pricing': {
    'bazarShoppingFee': 150,
    'bazarDeliveryFee': 80,
    'medicineDeliveryFee': 60,
    'parcelDeliveryFee': 60,
    'wagePerLabourer': 150,
    'loadingRatePerFloor': 50,
    'unloadingRatePerFloor': 20,
  },
  'vehicles': [
    {'id': 'v1', 'slug': 'pickup', 'name': {'bn': 'পিকআপ', 'en': 'Pickup'}, 'rate': 1200},
  ],
  'support': {'phone': '+8801700000000', 'whatsapp': 'https://wa.me/8801700000000'},
  'deliveryHours': {'bazar': [], 'shifting': [], 'medicine': [], 'parcel': []},
  'customerAuth': {'password': passwordOn},
});

class FakeApi extends Api {
  FakeApi(this.detail) : super(TokenStore(), onSessionEnded: (_) {}, onCustomer: (_) {});

  OrderDetail detail;
  final confirmed = <(int, int)>[];

  @override
  Future<OrderDetail> order(String id) async => detail;

  @override
  Future<OrderDetail> confirmOrder(String id, {required int total, required int quoteVersion}) async {
    confirmed.add((total, quoteVersion));
    return detail;
  }
}

class FakePush extends PushService {
  FakePush(super.ref);

  @override
  Future<PushStatus> status() async => PushStatus.on;
}

Widget app(Widget child, {List overrides = const []}) => ProviderScope(
  overrides: [...overrides],
  child: MaterialApp(theme: buildTheme(), home: child),
);

OrderDetail quoted() => OrderDetail.fromJson({
  'id': 'ord_1',
  'code': 'PA-1042',
  'service': 'bazar',
  'status': 'QUOTED',
  'summary': 'চাল',
  'total': 300,
  'scheduledDate': '2026-10-28',
  'scheduledTime': '10:00',
  'createdAt': '2026-10-27T08:05:00.000Z',
  'contactMobile': '01712345678',
  'itemsTotal': 70,
  'serviceFee': 150,
  'deliveryFee': 80,
  'items': [
    {'id': 'it_1', 'name': 'চাল', 'quantity': '1', 'price': 70},
  ],
  'events': [
    {'id': 'e1', 'to': 'PENDING', 'createdAt': '2026-10-27T08:05:00.000Z'},
    {'id': 'e2', 'to': 'QUOTED', 'createdAt': '2026-10-27T09:00:00.000Z'},
  ],
  'canCancel': true,
  'canConfirm': true,
  'quoteVersion': 2,
});

void main() {
  testWidgets('"Add more" appears only once the last row has its required boxes', (tester) async {
    var rows = <Map<String, String>>[{}];
    await tester.pumpWidget(
      app(
        StatefulBuilder(
          builder: (context, setState) => Scaffold(
            body: LineTable(
              tone: ServiceTone.of(ServiceId.bazar),
              columns: const [LineColumn('name', 'Item'), LineColumn('quantity', 'Quantity'), LineColumn('variety', 'Variety', optional: true)],
              priceLabel: 'Price',
              rows: rows,
              addLabel: 'Add more',
              onChanged: (next) => setState(() => rows = next),
            ),
          ),
        ),
      ),
    );
    expect(find.text('Add more'), findsNothing);
    await tester.enterText(find.byType(TextField).at(0), 'Rice');
    await tester.pump();
    expect(find.text('Add more'), findsNothing);
    await tester.enterText(find.byType(TextField).at(1), '1 kg');
    await tester.pump();
    expect(find.text('Add more'), findsOneWidget);
    await tester.tap(find.text('Add more'));
    await tester.pump();
    expect(rows.length, 2);
    expect(find.text('Add more'), findsNothing);
  });

  testWidgets('the password box shows only while the Catalog asks for one', (tester) async {
    await tester.pumpWidget(app(const AuthScreen(signup: false), overrides: [catalogProvider.overrideWith((ref) async => catalog())]));
    await tester.pumpAndSettle();
    expect(find.text('পাসওয়ার্ড'), findsNothing);
    // A fresh scope, so the catalog is read again.
    await tester.pumpWidget(const SizedBox());
    await tester.pumpWidget(app(const AuthScreen(signup: false), overrides: [catalogProvider.overrideWith((ref) async => catalog(passwordOn: true))]));
    await tester.pumpAndSettle();
    expect(find.text('পাসওয়ার্ড'), findsOneWidget);
  });

  testWidgets('Confirm sends the total and quote version on screen', (tester) async {
    tester.view.physicalSize = const Size(1080, 4000);
    tester.view.devicePixelRatio = 2.5;
    addTearDown(tester.view.reset);
    final api = FakeApi(quoted());
    await tester.pumpWidget(
      app(
        const OrderDetailScreen(id: 'ord_1'),
        overrides: [
          apiProvider.overrideWithValue(api),
          catalogProvider.overrideWith((ref) async => catalog()),
          pushProvider.overrideWith(FakePush.new),
          langProvider.overrideWith(() => LangController(Lang.en)),
        ],
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Your price is ready'), findsOneWidget);
    expect(find.text('Tk 300'), findsWidgets);
    await tester.tap(find.text('Confirm'));
    await tester.pumpAndSettle();
    expect(api.confirmed, [(300, 2)]);
  });
}
