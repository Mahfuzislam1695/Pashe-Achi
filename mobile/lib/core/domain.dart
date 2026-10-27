// Services, order statuses and their labels (ports of src/shared/enums.ts and labels.ts).
import 'i18n.dart';

enum ServiceId {
  bazar,
  shifting,
  medicine,
  parcel;

  static ServiceId? tryParse(Object? value) => ServiceId.values.where((s) => s.name == value).firstOrNull;

  Bilingual get label => switch (this) {
    ServiceId.bazar => const Bilingual('কাঁচা বাজার', 'Fresh market'),
    ServiceId.shifting => const Bilingual('বাসা বদল', 'House shifting'),
    ServiceId.medicine => const Bilingual('জরুরী ঔষুধ', 'Emergency medicine'),
    ServiceId.parcel => const Bilingual('পণ্য আদান প্রদান', 'Parcel delivery'),
  };

  /// Bazar, medicine and shifting are priced by staff on each order (a quote the customer confirms).
  bool get isQuoted => this != ServiceId.parcel;
}

enum OrderStatus {
  pending('PENDING', Bilingual('অপেক্ষমাণ', 'Pending')),
  quoted('QUOTED', Bilingual('দাম জানানো হয়েছে', 'Price sent')),
  booked('BOOKED', Bilingual('বুক করা হয়েছে', 'Booked')),
  inProgress('IN_PROGRESS', Bilingual('চলমান', 'In progress')),
  completed('COMPLETED', Bilingual('সম্পন্ন', 'Completed')),
  cancelled('CANCELLED', Bilingual('বাতিল', 'Cancelled'));

  const OrderStatus(this.api, this.label);

  final String api;
  final Bilingual label;

  static OrderStatus parse(Object? value) => OrderStatus.values.firstWhere((s) => s.api == value, orElse: () => OrderStatus.pending);
}

/// A bazar, medicine or shifting order still waiting for staff to price it.
bool isAwaitingPrice(ServiceId service, OrderStatus status) => service.isQuoted && status == OrderStatus.pending;
