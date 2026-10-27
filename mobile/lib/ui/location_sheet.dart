import 'dart:async';
import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:material_ui/material_ui.dart';

import '../config.dart';
import '../core/api.dart';
import '../core/i18n.dart';
import '../core/models.dart';
import '../core/session.dart';
import 'lucide.dart';
import 'theme.dart';
import 'widgets.dart';

/// Over this many metres, the device's position is only roughly right (typical of Wi-Fi location).
const _roughAccuracyMeters = 100.0;

/// Opens the map full screen and returns the place picked, or null when cancelled. [onSave] runs
/// before closing (Profile saves the location there); a failure keeps the map open with its message.
Future<Place?> pickPlace(
  BuildContext context, {
  required String title,
  Place? initial,
  bool? locate,
  String? submitLabel,
  Future<void> Function(Place place)? onSave,
}) {
  return Navigator.of(context, rootNavigator: true).push<Place>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => LocationSheet(title: title, initial: initial, locate: locate ?? initial == null, submitLabel: submitLabel, onSave: onSave),
    ),
  );
}

enum _Lookup { idle, looking, found, failed }

/// Picking a place on the map (the website's components/location-sheet.tsx). The customer moves the
/// map under a fixed pin; the address comes from the map, and they add only an optional house/flat/road.
class LocationSheet extends ConsumerStatefulWidget {
  const LocationSheet({super.key, required this.title, this.initial, required this.locate, this.submitLabel, this.onSave});

  final String title;
  final Place? initial;

  /// Start by finding the device (an empty box does).
  final bool locate;
  final String? submitLabel;
  final Future<void> Function(Place place)? onSave;

  @override
  ConsumerState<LocationSheet> createState() => _LocationSheetState();
}

class _LocationSheetState extends ConsumerState<LocationSheet> {
  final _map = MapController();
  late final _details = TextEditingController(text: widget.initial?.details ?? '');
  final _area = TextEditingController();

  GeoPoint? _pin;
  String _address = '';
  _Lookup _lookup = _Lookup.idle;
  bool _locating = false;
  bool _movedByHand = false;
  double? _accuracy;
  String? _error;
  bool _openSettings = false;
  bool _saving = false;

  Timer? _debounce;
  CancelToken? _inFlight;
  GeoPoint? _lookedUp;

  @override
  void initState() {
    super.initState();
    final initial = widget.initial;
    if (initial != null) {
      // Its address is already known: no lookup until the map moves.
      _pin = initial.pin;
      _lookedUp = initial.pin;
      _address = initial.address;
      _lookup = _Lookup.found;
    }
    if (widget.locate) {
      // From the first frame, so the map's opening position isn't taken for the customer's place.
      _locating = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => _findMe(auto: true));
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _inFlight?.cancel();
    _details.dispose();
    _area.dispose();
    super.dispose();
  }

  static double _round6(double value) => (value * 1e6).round() / 1e6;

  void _onMove(LatLng center, bool hasGesture) {
    // While the phone is still being located there is no pin yet: the map's own opening position
    // (Dhaka) is not the customer's place. _findMe settles the pin itself.
    if (!hasGesture && _pin == null && _locating) return;
    if (hasGesture && !_movedByHand) setState(() => _movedByHand = true);
    if (hasGesture && _accuracy != null) setState(() => _accuracy = null);
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 600), () => _settle(GeoPoint(_round6(center.latitude), _round6(center.longitude))));
  }

  /// The map came to rest: the pin is where it points, and its address is looked up.
  void _settle(GeoPoint pin, {bool force = false}) {
    if (!mounted) return;
    setState(() => _pin = pin);
    if (!force && pin == _lookedUp) return;
    _lookedUp = pin;
    _inFlight?.cancel();
    final cancel = _inFlight = CancelToken();
    setState(() {
      _lookup = _Lookup.looking;
      _address = '';
      _error = null;
    });
    ref
        .read(apiProvider)
        .reverseGeocode(pin, ref.read(langProvider), cancel: cancel)
        .then((address) {
          if (!mounted || cancel.isCancelled) return;
          setState(() {
            _address = address ?? '';
            _lookup = address == null ? _Lookup.failed : _Lookup.found;
          });
        })
        .catchError((Object error) {
          if (!mounted || cancel.isCancelled || (error is DioException && error.type == DioExceptionType.cancel)) return;
          setState(() => _lookup = _Lookup.failed);
        });
  }

  /// [auto]: the lookup on opening, which gives way if the customer already moved the map.
  Future<void> _findMe({bool auto = false}) async {
    setState(() {
      _locating = true;
      _error = null;
      _openSettings = false;
    });
    try {
      if (!await Geolocator.isLocationServiceEnabled()) throw const _LocationOff(settings: true);
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.deniedForever) throw const _LocationOff(settings: true);
      if (permission == LocationPermission.denied) throw const _LocationOff();
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 15)),
      );
      if (!mounted || (auto && _movedByHand)) return;
      final zoom = max(_map.camera.zoom, 17.0);
      _map.move(LatLng(position.latitude, position.longitude), zoom);
      setState(() => _accuracy = position.accuracy);
      _settle(GeoPoint(_round6(position.latitude), _round6(position.longitude)));
    } catch (error) {
      if (!mounted || (auto && _movedByHand)) return;
      setState(() {
        _error = 'location.unavailable';
        _openSettings = error is _LocationOff && error.settings;
      });
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _submit() async {
    final pin = _pin;
    if (pin == null) return setState(() => _error = 'location.pin');
    if (_lookup == _Lookup.looking || _saving) return;
    final address = (_lookup == _Lookup.failed ? _area.text : _address).trim();
    if (address.isEmpty) return setState(() => _error = _lookup == _Lookup.failed ? 'location.address' : 'location.pin');
    if (address.length > 300 || _details.text.trim().length > 120) return setState(() => _error = 'field.invalid');
    final place = Place(address: address, details: _details.text.trim(), pin: pin);
    if (widget.onSave != null) {
      setState(() => _saving = true);
      try {
        await widget.onSave!(place);
      } catch (error) {
        if (mounted) {
          setState(() {
            _saving = false;
            _error = errorCode(error, const ['location.required']);
          });
        }
        return;
      }
    }
    if (mounted) Navigator.of(context).pop(place);
  }

  String _offBy(L10n l) {
    final meters = ((_accuracy ?? 0) / 10).round() * 10;
    if (meters < 1000) return l.t('${l.digits(meters)} মিটার', '$meters m');
    final km = (meters / 100).round() / 10;
    return l.t('${l.digits(km)} কিমি', '$km km');
  }

  @override
  Widget build(BuildContext context) {
    final l = ref.watch(l10nProvider);
    // A new language: the address is looked up again in it.
    ref.listen(langProvider, (_, _) {
      final pin = _pin;
      if (pin != null && _lookup != _Lookup.failed) _settle(pin, force: true);
    });
    final start = widget.initial?.pin ?? dhakaCenter;
    final rough = (_accuracy ?? 0) > _roughAccuracyMeters;

    return Scaffold(
      backgroundColor: Kf.surface,
      appBar: AppBar(
        title: Text(widget.title),
        leading: IconButton(tooltip: l.t('বন্ধ করুন', 'Close'), icon: const Icon(LucideIcons.x), onPressed: () => Navigator.of(context).pop()),
      ),
      body: Column(
        children: [
          Expanded(
            flex: 11,
            child: Stack(
              children: [
                FlutterMap(
                  mapController: _map,
                  options: MapOptions(
                    initialCenter: LatLng(start.lat, start.lng),
                    initialZoom: widget.initial != null ? 17 : 13,
                    minZoom: 5,
                    maxZoom: 19,
                    interactionOptions: const InteractionOptions(flags: InteractiveFlag.all & ~InteractiveFlag.rotate),
                    onPositionChanged: (camera, hasGesture) => _onMove(camera.center, hasGesture),
                  ),
                  children: [
                    TileLayer(urlTemplate: AppConfig.tileUrl, userAgentPackageName: AppConfig.applicationId, maxNativeZoom: 19),
                    RichAttributionWidget(
                      alignment: AttributionAlignment.bottomLeft,
                      attributions: [
                        TextSourceAttribution('OpenStreetMap contributors', onTap: () => openLink(Uri.parse('https://www.openstreetmap.org/copyright'), inApp: true)),
                      ],
                    ),
                  ],
                ),
                // The pin stays in the middle; its tip marks the spot.
                const IgnorePointer(
                  child: Center(
                    child: Padding(
                      padding: EdgeInsets.only(bottom: 36),
                      child: Icon(LucideIcons.mapPin, size: 40, color: Kf.blue, fill: 1, shadows: [Shadow(color: Color(0x5510213A), blurRadius: 8)]),
                    ),
                  ),
                ),
                const IgnorePointer(
                  child: Center(
                    child: DecoratedBox(
                      decoration: BoxDecoration(color: Kf.blue, shape: BoxShape.circle, boxShadow: [BoxShadow(color: Color(0x401265D8), spreadRadius: 4)]),
                      child: SizedBox(width: 8, height: 8),
                    ),
                  ),
                ),
                Positioned(
                  top: 12,
                  right: 12,
                  child: Material(
                    color: Kf.surface,
                    borderRadius: BorderRadius.circular(999),
                    elevation: 3,
                    shadowColor: const Color(0x4010213A),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(999),
                      onTap: _locating ? null : () => _findMe(),
                      child: Container(
                        height: 44,
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _locating
                                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                                : const Icon(LucideIcons.locateFixed, size: 16, color: Kf.blue),
                            const SizedBox(width: 7),
                            Text(
                              _locating ? l.t('খোঁজা হচ্ছে…', 'Finding you…') : l.t('বর্তমান লোকেশন', 'Current location'),
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Kf.blue),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            flex: 10,
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(16, 14, 16, 16 + MediaQuery.paddingOf(context).bottom),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    rough
                        ? l.t(
                            'আপনার লোকেশন প্রায় ${_offBy(l)} এদিক-ওদিক হতে পারে। ম্যাপ সরিয়ে পিনটি ঠিক জায়গায় বসান।',
                            'Your location may be off by about ${_offBy(l)}. Drag the map to put the pin on the exact place.',
                          )
                        : l.t('ম্যাপ সরিয়ে পিনটি ঠিক জায়গায় বসান।', 'Drag the map to put the pin on the exact place.'),
                    style: TextStyle(fontSize: 12.5, color: rough ? Kf.orangeInk : Kf.muted, height: 1.5),
                  ),
                  const SizedBox(height: 12),
                  if (_lookup == _Lookup.failed) ...[
                    LabeledField(
                      label: l.t('এলাকা', 'Area'),
                      child: TextField(controller: _area, maxLength: 300, decoration: InputDecoration(hintText: l.t('যেমন: মিরপুর ১০, ঢাকা', 'e.g. Mirpur 10, Dhaka'), counterText: '')),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      l.t('ম্যাপে এই জায়গার ঠিকানা পাওয়া যায়নি, এলাকার নাম লিখুন।', "The map has no address for this place. Enter the area's name."),
                      style: const TextStyle(fontSize: 12, color: Kf.muted),
                    ),
                  ] else
                    LabeledField(
                      label: l.t('ম্যাপের ঠিকানা', 'Address from the map'),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                        decoration: BoxDecoration(color: Kf.surface2, borderRadius: BorderRadius.circular(Kf.radiusControl), border: Border.all(color: Kf.line)),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Padding(padding: EdgeInsets.only(top: 2), child: Icon(LucideIcons.mapPin, size: 15, color: Kf.blue)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Semantics(
                                liveRegion: true,
                                child: Text(
                                  _lookup == _Lookup.looking
                                      ? l.t('ম্যাপ থেকে ঠিকানা খোঁজা হচ্ছে…', 'Looking up the address…')
                                      : _address.isNotEmpty
                                      ? _address
                                      : _locating && _pin == null
                                      ? l.t('আপনার বর্তমান লোকেশন খোঁজা হচ্ছে…', 'Finding your current location…')
                                      : l.t('ম্যাপ সরিয়ে বা বর্তমান লোকেশন চেপে জায়গাটি বাছুন।', 'Move the map or tap Current location to pick the place.'),
                                  style: TextStyle(fontSize: 13.5, height: 1.5, color: _address.isNotEmpty ? Kf.ink : Kf.muted),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  const SizedBox(height: 14),
                  LabeledField(
                    label: l.t('বাসা/ফ্ল্যাট, রোড (ঐচ্ছিক)', 'House, flat, road (optional)'),
                    child: TextField(
                      controller: _details,
                      maxLength: 120,
                      textInputAction: TextInputAction.done,
                      autofillHints: const [AutofillHints.streetAddressLine2],
                      decoration: InputDecoration(hintText: l.t('যেমন: বাসা ১২, রোড ৫, ৩য় তলা', 'e.g. House 12, Road 5, 3rd floor'), counterText: ''),
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    FormErrorBox(code: _error),
                    if (_openSettings)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton.icon(
                          onPressed: () async {
                            if (!await Geolocator.isLocationServiceEnabled()) {
                              await Geolocator.openLocationSettings();
                            } else {
                              await Geolocator.openAppSettings();
                            }
                          },
                          icon: const Icon(LucideIcons.settings, size: 16),
                          label: Text(l.t('সেটিংস খুলুন', 'Open settings')),
                        ),
                      ),
                  ],
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(flex: 10, child: SecondaryButton(label: l.t('বাতিল', 'Cancel'), onPressed: () => Navigator.of(context).pop())),
                      const SizedBox(width: 10),
                      Expanded(
                        flex: 16,
                        child: PrimaryButton(
                          label: _saving ? l.t('অপেক্ষা করুন…', 'Please wait…') : (widget.submitLabel ?? l.t('এই লোকেশন ব্যবহার করুন', 'Use this location')),
                          icon: LucideIcons.check,
                          busy: _saving,
                          onPressed: _lookup == _Lookup.looking || (_locating && _pin == null) ? null : _submit,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LocationOff implements Exception {
  const _LocationOff({this.settings = false});

  /// Location is off or permanently refused: only the settings can change that.
  final bool settings;
}
