import java.io.File

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// ── Resolve the React Native root (needed for JSI headers in CMake) ──
val reactNativeDir: String by lazy {
    // Walks up from this build script to find node_modules/react-native
    var dir = rootProject.projectDir
    repeat(5) {
        val candidate = File(dir, "node_modules/react-native")
        if (candidate.exists()) return@lazy candidate.absolutePath
        dir = dir.parentFile ?: return@lazy ""
    }
    error("Could not locate node_modules/react-native from ${rootProject.projectDir}")
}

android {
    namespace  = "com.clarihear.android"
    compileSdk = 35

    defaultConfig {
        applicationId   = "com.clarihear.android"
        minSdk          = 29   // Android 10 — Oboe exclusive mode, DynamicsProcessing
        targetSdk       = 35
        versionCode     = 1
        versionName     = "2.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // ── NDK / CMake ────────────────────────────────────────────────
        ndk {
            //  arm64-v8a  : all modern Android phones
            //  x86_64     : emulator support
            abiFilters += listOf("arm64-v8a", "x86_64")
        }

        externalNativeBuild {
            cmake {
                cppFlags  += listOf("-std=c++17", "-O3", "-ffast-math")
                arguments += listOf(
                    "-DREACT_NATIVE_DIR=$reactNativeDir",
                    "-DANDROID_STL=c++_shared",   // shared libc++ (matches RN)
                    "-DANDROID_PLATFORM=android-29"
                )
            }
        }
    }

    // ── External CMake build ────────────────────────────────────────────
    externalNativeBuild {
        cmake {
            path    = file("src/main/cpp/CMakeLists.txt")
            version = "3.22.1"
        }
    }

    // ── Oboe via Prefab (AAR bundled headers + .so) ─────────────────────
    buildFeatures {
        prefab   = true   // enable Prefab to consume Oboe's AAR
        compose  = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.8"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            // Keep symbols for native crash analysis
            isJniDebuggable = true
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    packaging {
        resources { excludes += "/META-INF/{AL2.0,LGPL2.1}" }
        // Prevent duplicate libc++_shared.so
        jniLibs { pickFirsts += listOf("**/libc++_shared.so") }
    }
}

dependencies {
    // ── React Native (New Architecture) ────────────────────────────────
    implementation("com.facebook.react:react-android")   // populated by RN gradle plugin
    implementation("com.facebook.react:hermes-android")  // Hermes JS engine (required for New Arch)

    // ── Google Oboe — low-latency audio I/O (Prefab AAR) ───────────────
    //    Prefab exposes CMake package oboe::oboe
    implementation("com.google.oboe:oboe:1.9.0")

    // ── Jetpack Compose (UI) ────────────────────────────────────────────
    implementation(platform("androidx.compose:compose-bom:2024.04.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.0")

    // ── Serialisation ───────────────────────────────────────────────────
    implementation("com.google.code.gson:gson:2.11.0")

    // ── Test ────────────────────────────────────────────────────────────
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation(platform("androidx.compose:compose-bom:2024.04.00"))
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
