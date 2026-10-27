import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models.dart';
import '../../core/session.dart';
import '../../core/validation.dart';

/// A half-filled form that survives switching services (the website's lib/drafts.tsx). It starts
/// from the customer's location and mobile, and resets when a different customer signs in.
class DraftController<T> extends Notifier<T> {
  DraftController(this._initial);

  final T Function(Customer? customer) _initial;

  @override
  T build() {
    ref.watch(customerIdProvider);
    return _initial(ref.read(customerProvider));
  }

  void set(T value) => state = value;

  /// After an order is sent: a fresh form (each draft decides what it keeps).
  T fresh() => _initial(ref.read(customerProvider));
}

typedef Rows = List<Map<String, String>>;

class BazarDraft {
  const BazarDraft({this.place, this.mobile = '', this.schedule = const Schedule(), this.rows = const [{}]});

  final Place? place;
  final String mobile;
  final Schedule schedule;
  final Rows rows;

  BazarDraft copyWith({Place? place, String? mobile, Schedule? schedule, Rows? rows}) =>
      BazarDraft(place: place ?? this.place, mobile: mobile ?? this.mobile, schedule: schedule ?? this.schedule, rows: rows ?? this.rows);
}

class ShiftingDraft {
  const ShiftingDraft({this.loading, this.unloading, this.schedule = const Schedule(), this.vehicleId, this.labourers = 1, this.loadingFloor = 1, this.unloadingFloor = 1});

  final Place? loading;
  final Place? unloading;
  final Schedule schedule;
  final String? vehicleId;
  final int labourers;
  final int loadingFloor;
  final int unloadingFloor;

  ShiftingDraft copyWith({Place? loading, Place? unloading, Schedule? schedule, String? vehicleId, int? labourers, int? loadingFloor, int? unloadingFloor}) => ShiftingDraft(
    loading: loading ?? this.loading,
    unloading: unloading ?? this.unloading,
    schedule: schedule ?? this.schedule,
    vehicleId: vehicleId ?? this.vehicleId,
    labourers: labourers ?? this.labourers,
    loadingFloor: loadingFloor ?? this.loadingFloor,
    unloadingFloor: unloadingFloor ?? this.unloadingFloor,
  );
}

class MedicineDraft {
  const MedicineDraft({this.place, this.mobile = '', this.schedule = const Schedule(), this.prescription, this.rows = const [{}]});

  final Place? place;
  final String mobile;
  final Schedule schedule;
  final UploadInfo? prescription;
  final Rows rows;

  MedicineDraft copyWith({Place? place, String? mobile, Schedule? schedule, UploadInfo? prescription, bool clearPrescription = false, Rows? rows}) => MedicineDraft(
    place: place ?? this.place,
    mobile: mobile ?? this.mobile,
    schedule: schedule ?? this.schedule,
    prescription: clearPrescription ? null : (prescription ?? this.prescription),
    rows: rows ?? this.rows,
  );
}

class ParcelDraft {
  const ParcelDraft({this.product = '', this.weight = '', this.pickup, this.dropoff, this.receiverMobile = '', this.schedule = const Schedule()});

  final String product;
  final String weight;
  final Place? pickup;
  final Place? dropoff;
  final String receiverMobile;
  final Schedule schedule;

  ParcelDraft copyWith({String? product, String? weight, Place? pickup, Place? dropoff, String? receiverMobile, Schedule? schedule}) => ParcelDraft(
    product: product ?? this.product,
    weight: weight ?? this.weight,
    pickup: pickup ?? this.pickup,
    dropoff: dropoff ?? this.dropoff,
    receiverMobile: receiverMobile ?? this.receiverMobile,
    schedule: schedule ?? this.schedule,
  );
}

final bazarDraftProvider = NotifierProvider<DraftController<BazarDraft>, BazarDraft>(
  () => DraftController((c) => BazarDraft(place: c?.location, mobile: c?.mobile ?? '')),
);

final shiftingDraftProvider = NotifierProvider<DraftController<ShiftingDraft>, ShiftingDraft>(
  () => DraftController((c) => ShiftingDraft(loading: c?.location)),
);

final medicineDraftProvider = NotifierProvider<DraftController<MedicineDraft>, MedicineDraft>(
  () => DraftController((c) => MedicineDraft(place: c?.location, mobile: c?.mobile ?? '')),
);

final parcelDraftProvider = NotifierProvider<DraftController<ParcelDraft>, ParcelDraft>(
  () => DraftController((c) => ParcelDraft(pickup: c?.location)),
);
