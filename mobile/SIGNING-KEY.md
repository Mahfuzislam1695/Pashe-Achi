# The app's signing key

The Kingfisher app (`com.kingfisherbd24.app`) is signed with one upload key, on Google Play and on the website. Every update must be signed with this same key; with any other key, Android refuses to install it over the existing app.

**The key and its password are never in this repository.** The repository is public, and anyone holding both could sign an app that phones accept as an update of Kingfisher. This file only says which key is the right one and where its copies are kept.

## Which key

| | |
|---|---|
| Key file | `kingfisher-upload.jks` (PKCS12) |
| Alias | `upload` |
| Owner | CN=Kingfisher, OU=Mobile, O=Kingfisher, L=Dhaka, C=BD |
| Algorithm | RSA 4096-bit, SHA384withRSA |
| Valid | 6 November 2026 to 24 March 2054 |
| SHA-1 | `CC:F3:C2:F0:69:26:60:94:28:82:3A:BE:39:DE:51:EB:6D:6C:C7:61` |
| SHA-256 | `31:63:29:A7:09:D4:E5:F6:9C:9C:8B:15:E5:B9:A8:D3:B4:EC:68:30:A6:05:28:4A:FB:8E:E9:B7:C6:BE:88:09` |

To check that a build is signed with it, run the following command. The SHA-256 it prints must match the one above.

```powershell
E:\kingfisher-dev\jdk17\bin\keytool.exe -printcert -jarfile build\app\outputs\bundle\release\app-release.aab
```

## Where the copies are

Each copy has the `.jks` and `KEEP-SAFE-kingfisher-upload.md`, which holds the password, the GitHub secret values and the steps for Google Play.

| Copy | Location |
|---|---|
| Used by the builds | `E:\kingfisher-dev\keys\` |
| Backup on the office PC | `C:\Kingfisher-Signing-Key-BACKUP\` (also has the base64 file for the GitHub secret) |
| Cloud backup | the owner's private Google Drive or OneDrive folder |
| Offline backup | a USB drive |
| The password alone | the owner's password manager |

`mobile/android/key.properties` (gitignored) points the build to the key. On a new PC, the KEEP-SAFE note says what to put in it.

## Google Play

When the app is created, choose to upload this key as the app signing key (**App integrity → App signing → Export and upload a key from Java keystore**, with Google's PEPK tool). Then the APK on the website and the app from Google Play are signed alike and can update each other. The exact command is in the KEEP-SAFE note.

## History

- **27 October 2026:** the first key was made (SHA-256 `73:7C:8F:C1:AE:40:A0:0C:5F:7D:E3:A6:64:A4:1E:CE:44:89:89:B8:E6:15:33:A9:68:3D:6F:3E:5A:02:48:9D`). It was deleted with the old project folder on 6 November 2026, and it had no backup. It was never used on Google Play.
- **6 November 2026:** this key replaced it, starting with version 1.0.1 (build 2). The website APK from before (version 1.0.0, build 1) can't update to it, so those phones uninstall the old app once and install the new one.
