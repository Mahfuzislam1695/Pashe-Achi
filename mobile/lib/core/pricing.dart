// The bill preview (a port of src/shared/pricing.ts). The server recalculates every fee; after an
// order is placed the app shows the server's own snapshot, never these numbers.
import 'format.dart';
import 'models.dart';

class Bill {
  const Bill(this.itemsTotal, this.serviceFee, this.deliveryFee);

  final int itemsTotal;
  final int serviceFee;
  final int deliveryFee;

  int get total => itemsTotal + serviceFee + deliveryFee;
}

int _sum(Iterable<Object?> prices) => prices.fold(0, (total, price) => total + toAmount(price));

Bill calcBazar(Pricing pricing, Iterable<Object?> prices) => Bill(_sum(prices), pricing.bazarShoppingFee, pricing.bazarDeliveryFee);

Bill calcMedicine(Pricing pricing, Iterable<Object?> prices) => Bill(_sum(prices), 0, pricing.medicineDeliveryFee);

/// Labour and floors from the Catalog; the vehicle rent is null until staff price it by distance.
Bill calcShifting(Pricing pricing, {int? vehicleRate, required Object? labourers, required Object? loadingFloor, required Object? unloadingFloor}) {
  final labour = toAmount(labourers) * pricing.wagePerLabourer;
  final loading = toAmount(loadingFloor) * pricing.loadingRatePerFloor;
  final unloading = toAmount(unloadingFloor) * pricing.unloadingRatePerFloor;
  return Bill(toAmount(vehicleRate), labour + loading + unloading, 0);
}

Bill calcParcel(Pricing pricing) => Bill(0, 0, pricing.parcelDeliveryFee);
