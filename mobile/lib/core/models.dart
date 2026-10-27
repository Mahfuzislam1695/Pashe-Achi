// The API's response shapes (src/shared/types.ts), parsed by hand.
import 'domain.dart';
import 'i18n.dart';

typedef Json = Map<String, dynamic>;

int _int(Object? value) => value is num ? value.round() : int.tryParse('$value') ?? 0;
int? _intOrNull(Object? value) => value == null ? null : _int(value);
String _str(Object? value) => value == null ? '' : '$value';
String? _strOrNull(Object? value) => value == null || '$value'.isEmpty ? null : '$value';
List<Json> _list(Object? value) => [for (final item in (value as List?) ?? const []) item as Json];

class GeoPoint {
  const GeoPoint(this.lat, this.lng);

  static GeoPoint? tryParse(Object? json) {
    if (json is! Map) return null;
    final lat = json['lat'], lng = json['lng'];
    return lat is num && lng is num ? GeoPoint(lat.toDouble(), lng.toDouble()) : null;
  }

  final double lat;
  final double lng;

  Json toJson() => {'lat': lat, 'lng': lng};

  /// Google Maps for this pin (src/shared/geo.ts mapLink).
  Uri get mapLink => Uri.parse('https://www.google.com/maps/search/?api=1&query=$lat,$lng');

  @override
  bool operator ==(Object other) => other is GeoPoint && other.lat == lat && other.lng == lng;

  @override
  int get hashCode => Object.hash(lat, lng);
}

/// Dhaka, where a map opens when there is no pin yet (src/shared/geo.ts DHAKA_CENTER).
const dhakaCenter = GeoPoint(23.8103, 90.4125);

/// A place picked on the map: the address the map gave, the house/flat/road the customer added, and
/// the pin. The value of every address box, and the customer's one location.
class Place {
  const Place({required this.address, this.details = '', required this.pin});

  static Place? tryParse(Object? json) {
    if (json is! Map) return null;
    final pin = GeoPoint.tryParse(json);
    if (pin == null) return null;
    return Place(address: _str(json['address']), details: _str(json['details']), pin: pin);
  }

  final String address;
  final String details;
  final GeoPoint pin;

  /// "details, address" (src/shared/geo.ts joinAddress).
  String get text => details.trim().isEmpty ? address : '${details.trim()}, $address';

  Json toJson() => {'address': address, if (details.trim().isNotEmpty) 'details': details.trim(), ...pin.toJson()};
}

class Customer {
  const Customer({required this.id, required this.name, required this.mobile, this.location, required this.points, required this.lang, required this.createdAt});

  factory Customer.fromJson(Json json) => Customer(
    id: _str(json['id']),
    name: _str(json['name']),
    mobile: _str(json['mobile']),
    location: Place.tryParse(json['location']),
    points: _int(json['points']),
    lang: Lang.parse(json['lang']),
    createdAt: _str(json['createdAt']),
  );

  final String id;
  final String name;
  final String mobile;
  final Place? location;
  final int points;
  final Lang lang;
  final String createdAt;
}

class AuthTokens {
  const AuthTokens(this.accessToken, this.refreshToken);

  factory AuthTokens.fromJson(Json json) => AuthTokens(_str(json['accessToken']), _str(json['refreshToken']));

  final String accessToken;
  final String refreshToken;
}

class AuthResult {
  const AuthResult(this.user, this.tokens);

  factory AuthResult.fromJson(Json json) => AuthResult(Customer.fromJson(json['user'] as Json), AuthTokens.fromJson(json['tokens'] as Json));

  final Customer user;
  final AuthTokens tokens;
}

class Pricing {
  const Pricing({
    required this.bazarShoppingFee,
    required this.bazarDeliveryFee,
    required this.medicineDeliveryFee,
    required this.parcelDeliveryFee,
    required this.wagePerLabourer,
    required this.loadingRatePerFloor,
    required this.unloadingRatePerFloor,
  });

  factory Pricing.fromJson(Json json) => Pricing(
    bazarShoppingFee: _int(json['bazarShoppingFee']),
    bazarDeliveryFee: _int(json['bazarDeliveryFee']),
    medicineDeliveryFee: _int(json['medicineDeliveryFee']),
    parcelDeliveryFee: _int(json['parcelDeliveryFee']),
    wagePerLabourer: _int(json['wagePerLabourer']),
    loadingRatePerFloor: _int(json['loadingRatePerFloor']),
    unloadingRatePerFloor: _int(json['unloadingRatePerFloor']),
  );

  final int bazarShoppingFee;
  final int bazarDeliveryFee;
  final int medicineDeliveryFee;
  final int parcelDeliveryFee;
  final int wagePerLabourer;
  final int loadingRatePerFloor;
  final int unloadingRatePerFloor;
}

class Vehicle {
  const Vehicle({required this.id, required this.name, required this.rate});

  factory Vehicle.fromJson(Json json) => Vehicle(id: _str(json['id']), name: Bilingual.fromJson(json['name']), rate: _int(json['rate']));

  final String id;
  final Bilingual name;

  /// A starting rate ("… টাকা থেকে"); staff price the rent by distance.
  final int rate;
}

/// A delivery window, HH:mm to HH:mm.
class DeliveryWindow {
  const DeliveryWindow(this.from, this.to);

  final String from;
  final String to;
}

class Catalog {
  const Catalog({required this.pricing, required this.vehicles, required this.supportPhone, required this.supportWhatsapp, required this.deliveryHours, required this.passwordOn});

  factory Catalog.fromJson(Json json) {
    final support = (json['support'] as Json?) ?? const {};
    final hours = (json['deliveryHours'] as Json?) ?? const {};
    return Catalog(
      pricing: Pricing.fromJson(json['pricing'] as Json),
      vehicles: [for (final v in _list(json['vehicles'])) Vehicle.fromJson(v)],
      supportPhone: _str(support['phone']),
      supportWhatsapp: _str(support['whatsapp']),
      deliveryHours: {
        for (final service in ServiceId.values)
          service: [for (final w in _list(hours[service.name])) DeliveryWindow(_str(w['from']), _str(w['to']))],
      },
      passwordOn: (json['customerAuth'] as Json?)?['password'] == true,
    );
  }

  final Pricing pricing;
  final List<Vehicle> vehicles;
  final String supportPhone;
  final String supportWhatsapp;
  final Map<ServiceId, List<DeliveryWindow>> deliveryHours;

  /// The super admin's switch: when off, the mobile number alone signs up and logs in.
  final bool passwordOn;
}

class OrderSummary {
  const OrderSummary({
    required this.id,
    required this.code,
    required this.service,
    required this.status,
    required this.summary,
    required this.total,
    required this.scheduledDate,
    required this.scheduledTime,
    required this.createdAt,
  });

  factory OrderSummary.fromJson(Json json) => OrderSummary(
    id: _str(json['id']),
    code: _str(json['code']),
    service: ServiceId.tryParse(json['service']) ?? ServiceId.bazar,
    status: OrderStatus.parse(json['status']),
    summary: _str(json['summary']),
    total: _int(json['total']),
    scheduledDate: _str(json['scheduledDate']),
    scheduledTime: _str(json['scheduledTime']),
    createdAt: _str(json['createdAt']),
  );

  final String id;
  final String code;
  final ServiceId service;
  final OrderStatus status;
  final String summary;
  final int total;
  final String scheduledDate;
  final String scheduledTime;
  final String createdAt;
}

class OrderLine {
  const OrderLine({required this.id, required this.name, required this.quantity, this.variety, this.company, this.category, this.price});

  factory OrderLine.fromJson(Json json) => OrderLine(
    id: _str(json['id']),
    name: _str(json['name']),
    quantity: _str(json['quantity']),
    variety: _strOrNull(json['variety']),
    company: _strOrNull(json['company']),
    category: _strOrNull(json['category']),
    price: _intOrNull(json['price']),
  );

  final String id;
  final String name;
  final String quantity;
  final String? variety;
  final String? company;
  final String? category;

  /// Null until staff price it.
  final int? price;
}

class ShiftingInfo {
  const ShiftingInfo({
    required this.loadingArea,
    required this.unloadingArea,
    this.loadingPin,
    this.unloadingPin,
    required this.vehicleName,
    this.vehicleRate,
    required this.labourers,
    required this.loadingFloor,
    required this.unloadingFloor,
  });

  factory ShiftingInfo.fromJson(Json json) => ShiftingInfo(
    loadingArea: _str(json['loadingArea']),
    unloadingArea: _str(json['unloadingArea']),
    loadingPin: GeoPoint.tryParse(json['loadingPin']),
    unloadingPin: GeoPoint.tryParse(json['unloadingPin']),
    vehicleName: Bilingual.fromJson(json['vehicleName']),
    vehicleRate: _intOrNull(json['vehicleRate']),
    labourers: _int(json['labourers']),
    loadingFloor: _int(json['loadingFloor']),
    unloadingFloor: _int(json['unloadingFloor']),
  );

  final String loadingArea;
  final String unloadingArea;
  final GeoPoint? loadingPin;
  final GeoPoint? unloadingPin;
  final Bilingual vehicleName;

  /// The rent staff set by distance; null until they send it.
  final int? vehicleRate;
  final int labourers;
  final int loadingFloor;
  final int unloadingFloor;
}

class ParcelInfo {
  const ParcelInfo({required this.product, this.weight, required this.pickupAddress, required this.dropoffAddress, this.pickupPin, this.dropoffPin, required this.receiverMobile});

  factory ParcelInfo.fromJson(Json json) => ParcelInfo(
    product: _str(json['product']),
    weight: _strOrNull(json['weight']),
    pickupAddress: _str(json['pickupAddress']),
    dropoffAddress: _str(json['dropoffAddress']),
    pickupPin: GeoPoint.tryParse(json['pickupPin']),
    dropoffPin: GeoPoint.tryParse(json['dropoffPin']),
    receiverMobile: _str(json['receiverMobile']),
  );

  final String product;
  final String? weight;
  final String pickupAddress;
  final String dropoffAddress;
  final GeoPoint? pickupPin;
  final GeoPoint? dropoffPin;
  final String receiverMobile;
}

class UploadInfo {
  const UploadInfo({required this.id, required this.originalName, required this.mime, required this.size});

  factory UploadInfo.fromJson(Json json) => UploadInfo(id: _str(json['id']), originalName: _str(json['originalName']), mime: _str(json['mime']), size: _int(json['size']));

  final String id;
  final String originalName;
  final String mime;
  final int size;

  bool get isImage => mime.startsWith('image/');
}

class OrderEvent {
  const OrderEvent({required this.id, required this.to, this.note, required this.createdAt});

  factory OrderEvent.fromJson(Json json) =>
      OrderEvent(id: _str(json['id']), to: OrderStatus.parse(json['to']), note: _strOrNull(json['note']), createdAt: _str(json['createdAt']));

  final String id;
  final OrderStatus to;
  final String? note;
  final String createdAt;
}

class OrderDetail extends OrderSummary {
  const OrderDetail({
    required super.id,
    required super.code,
    required super.service,
    required super.status,
    required super.summary,
    required super.total,
    required super.scheduledDate,
    required super.scheduledTime,
    required super.createdAt,
    required this.contactMobile,
    this.address,
    this.addressPin,
    this.note,
    required this.itemsTotal,
    required this.serviceFee,
    required this.deliveryFee,
    required this.items,
    this.shifting,
    this.parcel,
    this.prescription,
    required this.events,
    required this.canCancel,
    required this.canConfirm,
    required this.quoteVersion,
  });

  factory OrderDetail.fromJson(Json json) {
    final summary = OrderSummary.fromJson(json);
    return OrderDetail(
      id: summary.id,
      code: summary.code,
      service: summary.service,
      status: summary.status,
      summary: summary.summary,
      total: summary.total,
      scheduledDate: summary.scheduledDate,
      scheduledTime: summary.scheduledTime,
      createdAt: summary.createdAt,
      contactMobile: _str(json['contactMobile']),
      address: _strOrNull(json['address']),
      addressPin: GeoPoint.tryParse(json['addressPin']),
      note: _strOrNull(json['note']),
      itemsTotal: _int(json['itemsTotal']),
      serviceFee: _int(json['serviceFee']),
      deliveryFee: _int(json['deliveryFee']),
      items: [for (final item in _list(json['items'])) OrderLine.fromJson(item)],
      shifting: json['shifting'] is Map ? ShiftingInfo.fromJson(json['shifting'] as Json) : null,
      parcel: json['parcel'] is Map ? ParcelInfo.fromJson(json['parcel'] as Json) : null,
      prescription: json['prescription'] is Map ? UploadInfo.fromJson(json['prescription'] as Json) : null,
      events: [for (final event in _list(json['events'])) OrderEvent.fromJson(event)],
      canCancel: json['canCancel'] == true,
      canConfirm: json['canConfirm'] == true,
      quoteVersion: _int(json['quoteVersion']),
    );
  }

  final String contactMobile;
  final String? address;
  final GeoPoint? addressPin;
  final String? note;
  final int itemsTotal;
  final int serviceFee;
  final int deliveryFee;
  final List<OrderLine> items;
  final ShiftingInfo? shifting;
  final ParcelInfo? parcel;
  final UploadInfo? prescription;

  /// Oldest first.
  final List<OrderEvent> events;
  final bool canCancel;
  final bool canConfirm;
  final int quoteVersion;

  /// The note staff sent with the latest price.
  String? get quoteNote => events.lastWhere((e) => e.to == OrderStatus.quoted, orElse: () => const OrderEvent(id: '', to: OrderStatus.pending, createdAt: '')).note;
}

class AppNotification {
  const AppNotification({required this.id, required this.type, required this.title, required this.body, this.orderId, this.offerId, this.readAt, required this.createdAt});

  factory AppNotification.fromJson(Json json) {
    final data = (json['data'] as Json?) ?? const {};
    return AppNotification(
      id: _str(json['id']),
      type: _str(json['type']),
      title: Bilingual.fromJson(json['title']),
      body: Bilingual.fromJson(json['body']),
      orderId: _strOrNull(data['orderId']),
      offerId: _strOrNull(data['offerId']),
      readAt: _strOrNull(json['readAt']),
      createdAt: _str(json['createdAt']),
    );
  }

  final String id;

  /// ORDER_STATUS, ORDER_BILL, ANNOUNCEMENT, OFFER (ORDER_CREATED goes to staff only).
  final String type;
  final Bilingual title;
  final Bilingual body;
  final String? orderId;
  final String? offerId;
  final String? readAt;
  final String createdAt;

  bool get isUnread => readAt == null;

  AppNotification markedRead() =>
      AppNotification(id: id, type: type, title: title, body: body, orderId: orderId, offerId: offerId, readAt: DateTime.now().toUtc().toIso8601String(), createdAt: createdAt);
}

class Offer {
  const Offer({required this.id, required this.title, this.body, this.service, this.imageUrl, required this.startsOn, required this.endsOn});

  factory Offer.fromJson(Json json) => Offer(
    id: _str(json['id']),
    title: Bilingual.fromJson(json['title']),
    body: json['body'] is Map ? Bilingual.fromJson(json['body']) : null,
    service: ServiceId.tryParse(json['service']),
    imageUrl: _strOrNull(json['imageUrl']),
    startsOn: _str(json['startsOn']),
    endsOn: _str(json['endsOn']),
  );

  final String id;
  final Bilingual title;
  final Bilingual? body;
  final ServiceId? service;

  /// A path on the site (/api/v1/offers/:id/image?v=…).
  final String? imageUrl;
  final String startsOn;
  final String endsOn;
}

/// One page of a list the API pages with a cursor.
class CursorPage<T> {
  const CursorPage(this.items, this.nextCursor);

  final List<T> items;
  final String? nextCursor;
}
