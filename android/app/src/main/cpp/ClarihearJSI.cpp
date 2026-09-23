// ============================================================
//  ClarihearJSI.cpp  —  Android JSI Installer (Phase 4)
//
//  How JSI installation works on Android (New Architecture):
//  ─────────────────────────────────────────────────────────────
//  1. Kotlin calls `nativeInstallJSI(jsiRuntimePtr)` via JNI,
//     passing the JSRuntime pointer from ReactInstanceManager.
//  2. We cast the pointer back to a jsi::Runtime* and call
//     installClarihearHostObject().
//  3. After return, global.clarihear exists in the Hermes runtime.
//
//  The jsiRuntimePtr comes from:
//    ReactInstanceManager → CatalystInstance → JSIExecutor → Hermes
//    Its value is passed to us via Kotlin using:
//      val rt = reactInstanceManager.currentReactContext
//                  ?.catalystInstance?.jsIRuntime ?: return
//      nativeInstallJSI(rt)
//
//  Timing: called in ReactContext.OnReactContextInitializedListener
//  which fires after the JS runtime starts but before any JS executes.
// ============================================================

#include "../../cpp/jsi/ClarihearHostObject.h"
#include "OboeAudioPlayer.h"

#include <jni.h>
#include <android/log.h>
#include <jsi/jsi.h>

#define LOG_TAG "ClarihearJSI"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO,  LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

// ── External references from ClarihearJNI.cpp ────────────────
// The singleton OboeAudioPlayer is created in JNI_OnLoad.
extern clarihear::OboeAudioPlayer* gPlayer;

// ============================================================
//  nativeInstallJSI
//  JNI function called from Kotlin's AudioModule.installJSI()
//
//  jsiRuntimePtr: the raw address of the facebook::jsi::Runtime*
//                 as a Java long (jlong = int64_t)
// ============================================================
extern "C" JNIEXPORT void JNICALL
Java_com_clarihear_android_AudioModule_nativeInstallJSI(
        JNIEnv* /*env*/,
        jobject /*thiz*/,
        jlong   jsiRuntimePtr) {

    if (jsiRuntimePtr == 0) {
        LOGE("nativeInstallJSI: jsiRuntimePtr is 0 — runtime not ready");
        return;
    }
    if (!gPlayer) {
        LOGE("nativeInstallJSI: gPlayer is null — JNI_OnLoad not called?");
        return;
    }

    // Reinterpret the long as a jsi::Runtime pointer.
    // This is the standard pattern used by:
    //   • react-native-reanimated (v2+)
    //   • react-native-mmkv
    //   • react-native-vision-camera
    auto* runtime = reinterpret_cast<facebook::jsi::Runtime*>(
        static_cast<uintptr_t>(jsiRuntimePtr));

    clarihear::AudioEngine& engine = gPlayer->dspEngine();

    // Platform start/stop lambdas — called from JS thread via Promise
    clarihear::StartFn startFn = []() -> bool {
        return gPlayer ? gPlayer->start() : false;
    };
    clarihear::StopFn stopFn = []() {
        if (gPlayer) gPlayer->stop();
    };

    // Install global.clarihear into the Hermes runtime
    clarihear::installClarihearHostObject(
        *runtime, &engine,
        std::move(startFn),
        std::move(stopFn));

    LOGI("✅ global.clarihear installed into Android Hermes runtime");
}
