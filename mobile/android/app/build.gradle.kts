import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Push notifications when the app is closed (Firebase Cloud Messaging) switch on once
// android/app/google-services.json is added (README.md, "Turning on push"). Without it the app
// still builds, and shows popups from the live connection while it runs.
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

// The upload key lives outside the repository; android/key.properties (gitignored) points to it.
// Without that file a release build is signed with the debug key: fine for testing, refused by
// Google Play, and it can't update an APK signed with the real key.
val keyProperties =
    Properties().apply {
        val file = rootProject.file("key.properties")
        if (file.exists()) file.inputStream().use { load(it) }
    }

android {
    namespace = "com.kingfisherbd24.app"
    compileSdk = 36
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // flutter_local_notifications uses java.time, which older Android versions get this way.
        isCoreLibraryDesugaringEnabled = true
    }

    defaultConfig {
        // Permanent once the app is on Google Play.
        applicationId = "com.kingfisherbd24.app"
        minSdk = 24
        // Google Play requires Android 16 (API 36) for new apps and updates from 31 August 2026.
        targetSdk = 36
        // From version: in pubspec.yaml (1.0.0+1 → versionName 1.0.0, versionCode 1).
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (keyProperties.isNotEmpty()) {
            create("release") {
                storeFile = file(keyProperties.getProperty("storeFile"))
                storePassword = keyProperties.getProperty("storePassword")
                keyAlias = keyProperties.getProperty("keyAlias")
                keyPassword = keyProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
}

flutter {
    source = "../.."
}
