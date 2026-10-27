// The logic ported from src/shared, checked against the same expectations as its TypeScript tests.
import 'package:flutter_test/flutter_test.dart';
import 'package:kingfisher/core/api.dart';
import 'package:kingfisher/core/delivery_hours.dart';
import 'package:kingfisher/core/domain.dart';
import 'package:kingfisher/core/format.dart';
import 'package:kingfisher/core/i18n.dart';
import 'package:kingfisher/core/messages.dart';
import 'package:kingfisher/core/models.dart';
import 'package:kingfisher/core/pricing.dart';
import 'package:kingfisher/core/validation.dart';

/// src/shared/pricing.ts DEFAULT_PRICING.
const pricing = Pricing(
  bazarShoppingFee: 150,
  bazarDeliveryFee: 80,
  medicineDeliveryFee: 60,
  parcelDeliveryFee: 60,
  wagePerLabourer: 150,
  loadingRatePerFloor: 50,
  unloadingRatePerFloor: 20,
);

const place = Place(address: 'উত্তরা, ঢাকা', pin: GeoPoint(23.807, 90.3687));

String inDays(int days) => isoDate(nowInDhaka().add(Duration(days: days)));

void main() {
  group('pricing', () {
    test('bills only the fees until staff price the order', () {
      expect(calcBazar(pricing, const []).total, 230);
      expect(calcMedicine(pricing, const []).total, 60);
      expect(calcParcel(pricing).total, 60);
      final shifting = calcShifting(pricing, labourers: 1, loadingFloor: 1, unloadingFloor: 1);
      expect([shifting.itemsTotal, shifting.serviceFee, shifting.total], [0, 220, 220]);
    });

    test('turns blank, negative and invalid amounts into 0, rounded', () {
      expect([toAmount(''), toAmount('-5'), toAmount('abc'), toAmount(null), toAmount('12.6'), toAmount(7)], [0, 0, 0, 0, 13, 7]);
      expect(calcBazar(pricing, ['100', 50, null]).itemsTotal, 150);
    });
  });

  group('delivery hours notice', () {
    const bazar = [DeliveryWindow('08:00', '10:00'), DeliveryWindow('18:00', '21:00')];

    test('reproduces the sketch notice for the default bazar hours', () {
      final notice = deliveryHoursNotice(ServiceId.bazar, bazar)!;
      expect(notice.bn, 'কাঁচা বাজার ডেলিভারির সময় সূচী: সকাল ৮ থেকে ১০ এবং সন্ধ্যা ৬ থেকে ৯ পর্যন্ত।');
      expect(notice.en, 'Fresh market delivery hours: 8–10 am and 6–9 pm.');
    });

    test('never says delivery on the shifting notice, and shows none without hours', () {
      expect(deliveryHoursNotice(ServiceId.shifting, bazar)!.bn, 'বাসা বদলের সময় সূচী: সকাল ৮ থেকে ১০ এবং সন্ধ্যা ৬ থেকে ৯ পর্যন্ত।');
      expect(deliveryHoursNotice(ServiceId.parcel, const []), isNull);
    });

    test('shows minutes and names both ends when a window crosses noon; lists windows in start order', () {
      final noon = describeDeliveryHours(const [DeliveryWindow('11:30', '14:00')]);
      expect([noon.bn, noon.en], ['সকাল ১১:৩০ থেকে দুপুর ২', '11:30 am–2 pm']);
      final three = describeDeliveryHours(const [DeliveryWindow('20:00', '22:00'), DeliveryWindow('07:00', '09:00'), DeliveryWindow('15:00', '17:00')]);
      expect(three.bn, 'সকাল ৭ থেকে ৯, বিকাল ৩ থেকে ৫ এবং রাত ৮ থেকে ১০');
      expect(three.en, '7–9 am, 3–5 pm and 8–10 pm');
    });
  });

  group('mobile numbers', () {
    test('normalises +880, spaces, dashes and Bengali digits', () {
      expect(normalizeMobile('+880 1712-345678'), '01712345678');
      expect(normalizeMobile('০১৭১২৩৪৫৬৭৮'), '01712345678');
      expect(normalizeMobile('1712345678'), '01712345678');
      expect(mobilePattern.hasMatch(normalizeMobile('01212345678')), isFalse);
    });
  });

  group('forms show one message, in the website order', () {
    final schedule = Schedule(date: isoDateInBd(), time: '09:30');

    test('login and signup', () {
      expect(validateLogin(mobile: '', passwordOn: false), 'auth.login');
      expect(validateLogin(mobile: '0171', passwordOn: false), 'mobile.invalid');
      expect(validateLogin(mobile: '01712345678', passwordOn: true), 'password.required');
      expect(validateLogin(mobile: '01712345678', passwordOn: false), isNull);
      expect(validateSignup(name: '', mobile: '', location: null, passwordOn: false), 'auth.signup');
      expect(validateSignup(name: 'রহিম', mobile: '01712345678', location: null, passwordOn: false), 'location.required');
      expect(validateSignup(name: 'রহিম', mobile: '01712345678', location: place, password: '123', passwordOn: true), 'password.short');
    });

    test('bazar: rows first, then the details, then the pin, mobile and schedule', () {
      expect(validateBazar(place: null, contactMobile: '', schedule: const Schedule(), rows: const [{}]), 'bazar.details');
      expect(validateBazar(place: place, contactMobile: '01712345678', schedule: schedule, rows: const [{'name': 'চাল'}]), 'bazar.rows');
      expect(validateBazar(place: place, contactMobile: '017', schedule: schedule, rows: const [{'name': 'চাল', 'quantity': '1 কেজি'}]), 'mobile.invalid');
      expect(validateBazar(place: place, contactMobile: '01712345678', schedule: Schedule(date: inDays(-1), time: '09:30'), rows: const [{'name': 'চাল', 'quantity': '1'}]), 'schedule.past');
      expect(validateBazar(place: place, contactMobile: '01712345678', schedule: schedule, rows: const [{'name': 'চাল', 'quantity': '1'}, {}]), isNull);
    });

    test('medicine needs a prescription or a full row', () {
      expect(validateMedicine(place: place, contactMobile: '01712345678', schedule: schedule, hasPrescription: false, rows: const [{}]), 'medicine.details');
      expect(validateMedicine(place: place, contactMobile: '01712345678', schedule: schedule, hasPrescription: true, rows: const [{}]), isNull);
      expect(validateMedicine(place: place, contactMobile: '01712345678', schedule: schedule, hasPrescription: true, rows: const [{'name': 'Napa'}]), 'medicine.rows');
    });

    test('shifting words a missing schedule its own way', () {
      String? check({Schedule? when, String? vehicle = 'v1', int labourers = 1}) =>
          validateShifting(loading: place, unloading: place, schedule: when ?? schedule, vehicleId: vehicle, labourers: labourers, loadingFloor: 1, unloadingFloor: 1);
      expect(check(when: const Schedule()), 'shifting.schedule_required');
      expect(check(vehicle: null), 'shifting.vehicle');
      expect(check(labourers: 51), 'shifting.numbers');
      expect(check(), isNull);
      expect(validateShifting(loading: null, unloading: place, schedule: schedule, vehicleId: 'v1', labourers: 1, loadingFloor: 1, unloadingFloor: 1), 'shifting.areas');
    });

    test('parcel', () {
      expect(validateParcel(product: '', pickup: place, dropoff: place, receiverMobile: '01712345678', schedule: schedule), 'parcel.details');
      expect(validateParcel(product: 'বই', pickup: place, dropoff: null, receiverMobile: '01712345678', schedule: schedule), 'parcel.details');
      expect(validateParcel(product: 'বই', weight: '২ কেজি', pickup: place, dropoff: place, receiverMobile: '01712345678', schedule: schedule), isNull);
    });
  });

  group('language helpers', () {
    const bn = L10n(Lang.bn);
    const en = L10n(Lang.en);

    test('dates read exactly as on the website, in Bangladesh time', () {
      expect(bn.formatDate('2026-10-27T08:05:00.000Z'), '২৭ অক্টো, ২০২৬');
      expect(bn.formatDate('2026-10-27T08:05:00.000Z', withTime: true), '২৭ অক্টো, ২০২৬, ২:০৫ PM');
      expect(en.formatDate('2026-10-27T08:05:00.000Z', withTime: true), '27 Oct 2026, 14:05');
      expect(en.formatDate('2026-10-27T18:30:00.000Z', withTime: true), '28 Oct 2026, 0:30');
      expect(bn.formatDate('2026-10-27T18:30:00.000Z', withTime: true), '২৮ অক্টো, ২০২৬, ১২:৩০ AM');
      expect(en.formatDate('2026-09-05'), '5 Sept 2026');
    });

    test('amounts keep Latin digits; counts and row numbers use Bengali ones', () {
      expect([bn.taka(230), en.taka(230)], ['230 টাকা', 'Tk 230']);
      expect([bn.digits(12), en.digits(12)], ['১২', '12']);
      expect([bn.rowNumber(0), en.rowNumber(0)], ['১।', '1.']);
    });
  });

  group('API errors', () {
    test('a form shows its own first issue, else the code, in the app wording', () {
      final error = ApiError(400, 'mobile.invalid', issueCodes: const ['mobile.invalid', 'bazar.rows']);
      expect(error.codeFor(formErrorPriority['bazar']!), 'bazar.rows');
      expect(ApiError(409, 'order.quote_changed').codeFor(), 'order.quote_changed');
      expect(errorCode(Exception('boom')), 'server');
      expect(ApiError(400, 'mystery', message: const Bilingual('অজানা', 'Unknown')).textFor(const L10n(Lang.en)), 'Unknown');
      expect(messageText('no.such.code').en, messageText('server').en);
    });
  });

  group('models', () {
    test('parse an order the way the API sends it', () {
      final order = OrderDetail.fromJson({
        'id': 'ord_1',
        'number': 1042,
        'code': 'PA-1042',
        'service': 'bazar',
        'status': 'QUOTED',
        'summary': 'চাল',
        'total': 300,
        'scheduledDate': '2026-10-28',
        'scheduledTime': '10:00',
        'createdAt': '2026-10-27T08:05:00.000Z',
        'contactMobile': '01712345678',
        'address': 'উত্তরা',
        'addressPin': {'lat': 23.8, 'lng': 90.4},
        'note': null,
        'itemsTotal': 70,
        'serviceFee': 150,
        'deliveryFee': 80,
        'items': [
          {'id': 'it_1', 'position': 0, 'name': 'চাল', 'quantity': '1', 'variety': null, 'company': null, 'category': null, 'price': 70},
        ],
        'shifting': null,
        'parcel': null,
        'prescription': null,
        'events': [
          {'id': 'e1', 'from': null, 'to': 'PENDING', 'note': null, 'actor': 'CUSTOMER', 'adminName': null, 'createdAt': '2026-10-27T08:05:00.000Z'},
          {'id': 'e2', 'from': 'PENDING', 'to': 'QUOTED', 'note': 'দাম বেড়েছে', 'actor': 'ADMIN', 'adminName': 'Mou', 'createdAt': '2026-10-27T09:00:00.000Z'},
        ],
        'canCancel': true,
        'canConfirm': true,
        'quoteVersion': 1,
      });
      expect([order.status, order.service, order.total, order.quoteVersion, order.items.single.price], [OrderStatus.quoted, ServiceId.bazar, 300, 1, 70]);
      expect(order.quoteNote, 'দাম বেড়েছে');
      expect(order.addressPin, const GeoPoint(23.8, 90.4));
    });

    test('a place joins its details before the address and sends no empty details', () {
      const withDetails = Place(address: 'উত্তরা, ঢাকা', details: 'বাসা ১২', pin: GeoPoint(23.8, 90.4));
      expect(withDetails.text, 'বাসা ১২, উত্তরা, ঢাকা');
      expect(place.toJson().containsKey('details'), isFalse);
    });
  });
}
