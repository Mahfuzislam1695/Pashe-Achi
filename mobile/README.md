# Kingfisher app (কিংফিশার)

The customer app for Android and iPhone, built with Flutter. It does everything the website does for a customer: the four services (কাঁচা বাজার, বাসা বদল, জরুরী ঔষুধ, পণ্য আদান প্রদান), order history with the price to confirm, notifications, today's offers and the profile. It talks to the same API as the website, `https://kingfisherbd24.com/api/v1`.

- **App id:** `com.kingfisherbd24.app` (Android application id and iOS bundle id). It can never change once the app is on Google Play or the App Store.
- **Version:** `version:` in `pubspec.yaml` (`1.0.0+1` means version 1.0.0, build 1). Raise the number after `+` for every APK or Play upload.
- **Same rules as the website.** The labels are the website's, word for word, and every price, fee and check comes from the server (`../CLAUDE.md` describes them).

## Building

The toolchain lives in one folder, `E:\kingfisher-dev`, outside the system PATH: Flutter 3.47.8, JDK 17 and the Android SDK. Open PowerShell and load it first:

```powershell
. E:\kingfisher-dev\env.ps1
cd E:\pashe-achi\Pashe-Achi\mobile
flutter pub get
flutter analyze
flutter test
# For the website: build/app/outputs/flutter-apk/app-release.apk, about 22 MB ("The APK on the website")
flutter build apk --release --target-platform android-arm,android-arm64 -P websiteApk=true
# For Google Play: build/app/outputs/bundle/release/app-release.aab
flutter build appbundle --release
```

To try the app against the server on this computer, run `npm run dev` in the project folder, start the emulator, then run the app on it. The emulator `kingfisher16k` is an Android 16 phone with 16 KB memory pages, the kind Google Play checks apps against.

```powershell
emulator -avd kingfisher16k        # opens the phone in its own window; leave it running
flutter run --dart-define=API_BASE=http://10.0.2.2:3000/api/v1
```

Release builds always use `https://kingfisherbd24.com`.

### The APK on the website

`/app-download` links to `public/downloads/kingfisher.apk` (`APP_DOWNLOADS` in `../src/shared/brand.ts`). After a new build:

1. Raise the build number in `pubspec.yaml`.
2. Build it with the website command: `flutter build apk --release --target-platform android-arm,android-arm64 -P websiteApk=true`.
3. Copy `build/app/outputs/flutter-apk/app-release.apk` to `../public/downloads/kingfisher.apk`.
4. Deploy the website.

Phones that installed the APK from the website update by installing the new one over it.

**Why the website build is different.** A plain `flutter build apk --release` works too, but it comes to about 65 MB, because it carries uncompressed code for three kinds of processor. The website build keeps only the two that phones use (64-bit ARM and older 32-bit ARM) and compresses them. That brings it to about 22 MB, which matters on mobile data. Google Play gets the bundle, which keeps everything and sends each phone only its own part.

## The signing key (keep it safe)

Release builds are signed with the upload key `E:\kingfisher-dev\keys\kingfisher-upload.jks`. Its password is in `E:\kingfisher-dev\keys\KEEP-SAFE-kingfisher-upload.txt`, and `android/key.properties` (never committed) points to both.

- **Back up the `.jks` file and its password** to a password manager and a second drive. Every update, on the website and on Google Play, must be signed with this same key. Without it, existing installs can't be updated.
- **Google Play.** When the Play Console asks how to sign the app, choose to upload your own key ("Use my own key" / "Export and upload a key from Java keystore") and give it this key. Then the APK on the website and the app from Google Play are signed the same way and can update each other. If Google generates its own key instead, a phone that installed the website APK must uninstall it before installing from Play.
- Without `key.properties`, a release build is signed with a debug key: fine for trying on a phone, refused by Google Play.

## Turning on push (popups when the app is closed)

Without these steps, popups come only through the live connection, so only while the app is open. Android freezes an app in the background within a minute or two, and a frozen app hears nothing (checked on Android 16). With Firebase Cloud Messaging (FCM, free) they also arrive in the background and when the app is closed. The store listing promises them, so set this up before publishing.

1. Go to <https://console.firebase.google.com>, then **Create a project** (for example "Kingfisher"). Google Analytics is not needed.
2. **Add app → Android**:
   - Package name: `com.kingfisherbd24.app`.
   - Download `google-services.json` and put it in `mobile/android/app/`.
   - Keep it out of git; the repository is public.
3. **Project settings → Service accounts → Generate new private key**. This downloads a JSON key for the server. Turn it into one line:
   ```bash
   node -e "console.log(require('fs').readFileSync('key.json').toString('base64'))"
   ```
   Put the result in `FCM_SERVICE_ACCOUNT=` in the server's `.env`, then restart the server. Delete the downloaded key file afterwards.
4. Build the APK again (and the bundle for Play). The app registers each phone with the server after sign-in. `GET /notifications` keeps working as before.

For the iPhone app, also:
- **Add app → iOS**, bundle id `com.kingfisherbd24.app`, and put `GoogleService-Info.plist` in `mobile/ios/Runner/`.
- In **Project settings → Cloud Messaging**, upload an APNs key (from the Apple Developer account: **Keys**, then **+**, with Apple Push Notifications service enabled).

## Building in the cloud (GitHub Actions)

`.github/workflows/mobile.yml` runs on every push that changes `mobile/`. It analyzes, tests and builds the APK and the Play bundle, and offers them as a download under the run's **Artifacts**. A tag such as `app-v1.0.1` also attaches `kingfisher.apk` to a GitHub Release.

Add these repository secrets (GitHub → Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the `.jks` file in base64: `node -e "console.log(require('fs').readFileSync('E:/kingfisher-dev/keys/kingfisher-upload.jks').toString('base64'))"` |
| `ANDROID_KEYSTORE_PASSWORD` | the password from `KEEP-SAFE-kingfisher-upload.txt` |
| `ANDROID_KEY_ALIAS` | `upload` |
| `GOOGLE_SERVICES_JSON` | the contents of `google-services.json` (optional, for push) |

Without the key, the cloud builds are marked UNSIGNED and are for testing only. Running the workflow by hand (**Actions → Mobile app → Run workflow**) can also check that the iPhone app compiles.

## Google Play checklist

1. **Developer account** at <https://play.google.com/console> ($25 once).
   - A new personal account must run a **closed test with at least 12 testers for 14 days** before it can publish to everyone.
   - An organisation account (needs a D-U-N-S number) skips that.
2. **Create app**: name "Kingfisher" (or the title in `store/listing.md`), default language Bangla or English, app (not game), free.
3. **App content**:
   - **Privacy policy:** `https://kingfisherbd24.com/privacy`
   - **App access:** "All or some functionality is restricted"; tell reviewers: "Sign up with any Bangladeshi mobile number in the form 01XXXXXXXXX. No code or password is needed."
   - **Ads:** No ads.
   - **Content rating:** answer the questionnaire (no violence, no user chat between users, no gambling). Expect "Everyone".
   - **Target audience:** 18 and over (or 13+); the app is not designed for children.
   - **Data safety:** the answers are in `store/data-safety.md`.
   - **Account deletion:** in the app (Profile → Delete account) and on the web at `https://kingfisherbd24.com/account-deletion`.
   - **Health apps declaration:** the app delivers medicine people order, with their prescription; it gives no diagnosis or treatment advice.
   - **Government apps, Financial features, News:** none.
4. **Store listing**: texts in `store/listing.md`, the 512×512 icon `store/icon-512.png`, a 1024×500 feature graphic `store/feature-graphic.png`, and the eight phone screenshots in `store/screenshots/`.
5. **App signing**: upload your own key (see "The signing key").
6. **Push**: set up Firebase first ("Turning on push"), then build the bundle; the listing promises a notification at every step.
7. **Release**: upload `app-release.aab` to the closed test track, then production once Play allows.

What the app already does for Play's rules:
- Targets Android 16 (API 36), with 16 KB memory pages supported.
- Asks for location only on the map, in the foreground.
- Picks photos with the system photo picker, so it has no storage or media permission.
- Asks for notifications when they are useful (after the first order), never at launch.
- Has no advertising ID and no ads.
- Sends everything over HTTPS only.
- Lets people delete their account in the app and on the web.

## iPhone

The project is set up for iOS:
- bundle id `com.kingfisherbd24.app`, iOS 15 or newer
- location, camera and photo reasons, in English and Bangla
- push entitlement and background notifications

Building and publishing needs a Mac with Xcode and an Apple Developer account ($99 a year):

1. On the Mac: `flutter build ios --release`, or open `ios/Runner.xcworkspace` in Xcode.
2. In Xcode, under **Signing & Capabilities**, pick your team. **Push Notifications** is already there (`Runner.entitlements`).
3. Add an app privacy manifest (**File → New → File → App Privacy**) if App Store Connect asks for one, and fill in App Store Connect's privacy answers from `store/data-safety.md`.
4. **Product → Archive**, upload to App Store Connect, test with TestFlight, then submit. Apple also requires account deletion in the app, which the app already has.

## Before each release: a check on a phone

1. **Sign in.** Install the APK, sign up with a new number (pick the location on the map; check the "Current location" pin), and log out and back in.
2. **Place one order per service:**
   - Fresh market with two lines
   - House shifting with a vehicle and counts
   - Emergency medicine with a prescription photo
   - Parcel
3. **Answer a price.** In the admin panel, send a price for the bazar order. The phone should pop up "price ready". Tap the popup: the order opens with the price card. Confirm it.
4. **Switch language.** Bangla ↔ English from the top bar: the screens, the date picker and new notifications follow it.
5. **Notifications.** On the Notifications screen, turn popups off and back on.
6. **Delete account.** With no running orders: Profile → Delete account. The app returns to the welcome screen with "Your account has been deleted."
