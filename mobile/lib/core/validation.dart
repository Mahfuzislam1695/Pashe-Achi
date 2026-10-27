// The checks the forms make before sending (ports of the shared Zod schemas in src/shared/schemas).
// Each returns the one message code a form shows, in the website's order, or null when all is well.
// The API checks everything again.
import 'format.dart';
import 'messages.dart';
import 'models.dart';

/// A delivery date (YYYY-MM-DD) and time (HH:mm); empty strings until picked.
class Schedule {
  const Schedule({this.date = '', this.time = ''});

  final String date;
  final String time;

  Schedule copyWith({String? date, String? time}) => Schedule(date: date ?? this.date, time: time ?? this.time);

  Map<String, String> toJson() => {'date': date, 'time': time};
}

class _Issues {
  final codes = <String>[];

  void add(String code) => codes.add(code);

  /// Blank → [code]; longer than [max] → field.invalid.
  void text(String value, String code, int max) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) {
      add(code);
    } else if (trimmed.length > max) {
      add('field.invalid');
    }
  }

  void optionalText(String? value, int max) {
    if (value != null && value.trim().length > max) add('field.invalid');
  }

  /// Blank → [code]; not 01[3-9]XXXXXXXX after normalising → mobile.invalid.
  void mobile(String value, String code) {
    if (value.trim().isEmpty) {
      add(code);
    } else if (!mobilePattern.hasMatch(normalizeMobile(value))) {
      add('mobile.invalid');
    }
  }

  void schedule(Schedule schedule) {
    if (!RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(schedule.date)) {
      add('schedule.required');
    } else if (schedule.date.compareTo(isoDateInBd()) < 0) {
      add('schedule.past');
    }
    if (!RegExp(r'^([01]\d|2[0-3]):[0-5]\d$').hasMatch(schedule.time)) add('schedule.required');
  }

  void place(Place? place, String code, int max) {
    text(place?.text ?? '', code, max);
    if (place == null) add('location.required');
  }

  String? pick(List<String> priority) => codes.isEmpty ? null : pickIssueCode(codes, priority);
}

/// Fully blank rows are left out; a row is "started" once any box has text.
bool isRowStarted(Map<String, String> row) => row.values.any((value) => value.trim().isNotEmpty);

String? validateLogin({required String mobile, String? password, required bool passwordOn}) {
  final issues = _Issues()..mobile(mobile, 'auth.login');
  if (passwordOn) {
    if ((password ?? '').isEmpty) {
      issues.add('password.required');
    } else if (password!.length > 72) {
      issues.add('field.invalid');
    }
  }
  return issues.pick(formErrorPriority['login']!);
}

void _password(_Issues issues, String? password) {
  final value = password ?? '';
  if (value.isEmpty) {
    issues.add('password.required');
  } else if (value.length < 6) {
    issues.add('password.short');
  } else if (value.length > 72) {
    issues.add('field.invalid');
  }
}

String? validateSignup({required String name, required String mobile, required Place? location, String? password, required bool passwordOn}) {
  final issues = _Issues()
    ..text(name, 'auth.signup', 80)
    ..mobile(mobile, 'auth.signup');
  if (location == null) issues.add('location.required');
  if (passwordOn) _password(issues, password);
  return issues.pick(formErrorPriority['signup']!);
}

String? validateProfile({required String name, required String mobile}) {
  final issues = _Issues()
    ..text(name, 'profile.name', 80)
    ..mobile(mobile, 'profile.mobile');
  return issues.pick(formErrorPriority['profile']!);
}

String? validateChangePassword({required String current, required String next}) {
  final issues = _Issues();
  if (current.isEmpty) issues.add('password.wrong');
  if (next.length < 6) issues.add('password.short');
  if (next.length > 72) issues.add('field.invalid');
  return issues.pick(const ['password.wrong', 'password.short']);
}

String? validateBazar({required Place? place, required String contactMobile, required Schedule schedule, required List<Map<String, String>> rows}) {
  final issues = _Issues()
    ..place(place, 'bazar.details', 300)
    ..mobile(contactMobile, 'bazar.details')
    ..schedule(schedule);
  final started = rows.where(isRowStarted).toList();
  if (started.isEmpty) issues.add('bazar.details');
  if (started.length > 60) issues.add('field.invalid');
  for (final row in started) {
    issues
      ..text(row['name'] ?? '', 'bazar.rows', 120)
      ..text(row['quantity'] ?? '', 'bazar.rows', 40)
      ..optionalText(row['variety'], 80);
  }
  return issues.pick(formErrorPriority['bazar']!);
}

String? validateMedicine({required Place? place, required String contactMobile, required Schedule schedule, required bool hasPrescription, required List<Map<String, String>> rows}) {
  final issues = _Issues()
    ..place(place, 'medicine.details', 300)
    ..mobile(contactMobile, 'medicine.details')
    ..schedule(schedule);
  final started = rows.where(isRowStarted).toList();
  if (started.length > 60) issues.add('field.invalid');
  for (final row in started) {
    issues
      ..text(row['name'] ?? '', 'medicine.rows', 120)
      ..text(row['quantity'] ?? '', 'medicine.rows', 40)
      ..text(row['company'] ?? '', 'medicine.rows', 80)
      ..text(row['category'] ?? '', 'medicine.rows', 80);
  }
  if (!hasPrescription && started.isEmpty) issues.add('medicine.details');
  return issues.pick(formErrorPriority['medicine']!);
}

/// The website words a missing shifting schedule its own way ("শিফটিং এর তারিখ ও সময় দিন।").
String? validateShifting({
  required Place? loading,
  required Place? unloading,
  required Schedule schedule,
  required String? vehicleId,
  required int labourers,
  required int loadingFloor,
  required int unloadingFloor,
}) {
  final issues = _Issues()
    ..place(loading, 'shifting.areas', 200)
    ..place(unloading, 'shifting.areas', 200)
    ..schedule(schedule);
  if ((vehicleId ?? '').isEmpty) issues.add('shifting.vehicle');
  if (labourers < 0 || labourers > 50 || loadingFloor < 0 || loadingFloor > 60 || unloadingFloor < 0 || unloadingFloor > 60) issues.add('shifting.numbers');
  final code = issues.pick(formErrorPriority['shifting']!);
  return code == 'schedule.required' ? 'shifting.schedule_required' : code;
}

String? validateParcel({required String product, String? weight, required Place? pickup, required Place? dropoff, required String receiverMobile, required Schedule schedule}) {
  final issues = _Issues()
    ..text(product, 'parcel.details', 160)
    ..optionalText(weight, 40)
    ..place(pickup, 'parcel.details', 300)
    ..place(dropoff, 'parcel.details', 300)
    ..mobile(receiverMobile, 'parcel.details')
    ..schedule(schedule);
  return issues.pick(formErrorPriority['parcel']!);
}
