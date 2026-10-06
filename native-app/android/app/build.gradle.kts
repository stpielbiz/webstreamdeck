plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Release signing comes from environment variables set by the GitHub build.
// Without them the release build is signed with the debug key, which still
// installs fine on a Fire TV Stick.
val keystorePath: String? = System.getenv("ANDROID_KEYSTORE_PATH")

android {
    namespace = "app.streamdeck.tv"
    compileSdk = 34

    defaultConfig {
        applicationId = "app.streamdeck.tv"
        minSdk = 22
        targetSdk = 34
        versionCode = (System.getenv("VERSION_CODE") ?: "1").toInt()
        versionName = System.getenv("VERSION_NAME") ?: "1.0.0"
        buildConfigField(
            "String",
            "START_URL",
            "\"${System.getenv("STREAM_DECK_URL") ?: "https://webstreamdeck.lovable.app/tv/pair"}\"",
        )
    }

    signingConfigs {
        if (keystorePath != null) {
            create("release") {
                storeFile = file(keystorePath)
                storeType = "PKCS12"
                // Trim stray spaces/newlines picked up when pasting secrets.
                val storePass = System.getenv("ANDROID_KEYSTORE_PASSWORD")?.trim()
                storePassword = storePass
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")?.trim()
                // PKCS12 keys share the store password.
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")?.trim()?.ifEmpty { null } ?: storePass
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = if (keystorePath != null) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    val media3 = "1.4.1"
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.media3:media3-exoplayer:$media3")
    implementation("androidx.media3:media3-exoplayer-hls:$media3")
    implementation("androidx.media3:media3-datasource:$media3")
    implementation("androidx.media3:media3-ui:$media3")
    implementation("androidx.annotation:annotation-experimental:1.4.1")
}
