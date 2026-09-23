// ============================================================
//  ClarihearJNI.cpp  —  JNI Bridge: Kotlin ↔ OboeAudioPlayer
//
//  This file implements the `external fun` declarations in
//  AudioModule.kt. The JNI function naming convention is:
//    Java_<package_underscored>_<class>_<method>
//
//  The global OboeAudioPlayer instance is kept alive for the
//  app's lifetime — audio hardware is expensive to start/stop.
//
//  IMPORTANT: These JNI functions are called from the Kotlin/Java
//  thread — NOT the audio thread. Only the Oboe callback runs on
//  the audio thread. So it IS safe to log here.
// ============================================================

#include "OboeAudioPlayer.h"

#include <jni.h>
#include <android/log.h>
#include <memory>

#define LOG_TAG "ClarihearJNI"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO,  LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

// ── Singleton OboeAudioPlayer ─────────────────────────────────
// Using a raw pointer managed by JNI_OnLoad/JNI_OnUnload.
// We could use a global unique_ptr but the timing of static
// destructor calls vs. JVM shutdown is undefined.
static clarihear::OboeAudioPlayer* gPlayer = nullptr;

// Called when the .so is first loaded by System.loadLibrary()
extern "C" JNIEXPORT jint JNI_OnLoad(JavaVM* /*vm*/, void* /*reserved*/) {
    LOGI("JNI_OnLoad — creating OboeAudioPlayer");
    gPlayer = new clarihear::OboeAudioPlayer();
    return JNI_VERSION_1_6;
}

extern "C" JNIEXPORT void JNI_OnUnload(JavaVM* /*vm*/, void* /*reserved*/) {
    LOGI("JNI_OnUnload — destroying OboeAudioPlayer");
    delete gPlayer;
    gPlayer = nullptr;
}

// ── Helper macro: package + class prefix ─────────────────────
#define JNI_FUNC(name) \
    extern "C" JNIEXPORT \
    Java_com_clarihear_android_AudioModule_##name

// ============================================================
//  nativeStart
// ============================================================
JNI_FUNC(nativeStart)(JNIEnv* /*env*/, jobject /*thiz*/) -> jboolean {
    if (!gPlayer) return JNI_FALSE;
    return gPlayer->start() ? JNI_TRUE : JNI_FALSE;
}

// ============================================================
//  nativeStop
// ============================================================
JNI_FUNC(nativeStop)(JNIEnv* /*env*/, jobject /*thiz*/) -> void {
    if (gPlayer) gPlayer->stop();
}

// ============================================================
//  nativeIsRunning
// ============================================================
JNI_FUNC(nativeIsRunning)(JNIEnv* /*env*/, jobject /*thiz*/) -> jboolean {
    return (gPlayer && gPlayer->isRunning()) ? JNI_TRUE : JNI_FALSE;
}

// ============================================================
//  nativeSetEqBandGain
// ============================================================
JNI_FUNC(nativeSetEqBandGain)(JNIEnv* /*env*/, jobject /*thiz*/,
                               jint band, jfloat gainL, jfloat gainR) -> void {
    if (gPlayer)
        gPlayer->dspEngine().setEqBandGain((int)band, (float)gainL, (float)gainR);
}

// ============================================================
//  nativeApplyAudiogram
// ============================================================
JNI_FUNC(nativeApplyAudiogram)(JNIEnv* env, jobject /*thiz*/,
                                jfloatArray leftGains,
                                jfloatArray rightGains) -> void {
    if (!gPlayer) return;

    // Get raw pointers to the Java float arrays (GetFloatArrayElements
    // is safe here — we're on the Kotlin/JVM thread, not the audio thread)
    jfloat* left  = env->GetFloatArrayElements(leftGains,  nullptr);
    jfloat* right = env->GetFloatArrayElements(rightGains, nullptr);

    if (left && right) {
        gPlayer->dspEngine().applyAudiogram(
            reinterpret_cast<const float*>(left),
            reinterpret_cast<const float*>(right));
    }

    // Release without copying back (JNI_ABORT) — we only read them
    if (left)  env->ReleaseFloatArrayElements(leftGains,  left,  JNI_ABORT);
    if (right) env->ReleaseFloatArrayElements(rightGains, right, JNI_ABORT);
}

// ============================================================
//  nativeSetMasterVolume
// ============================================================
JNI_FUNC(nativeSetMasterVolume)(JNIEnv* /*env*/, jobject /*thiz*/,
                                 jfloat linear) -> void {
    if (gPlayer) gPlayer->dspEngine().setMasterVolume((float)linear);
}

// ============================================================
//  nativeSetFeedbackSuppression
// ============================================================
JNI_FUNC(nativeSetFeedbackSuppression)(JNIEnv* /*env*/, jobject /*thiz*/,
                                        jboolean enabled) -> void {
    if (gPlayer)
        gPlayer->dspEngine().setFeedbackSuppression(enabled == JNI_TRUE);
}

// ============================================================
//  nativeGetInputLevelDb / nativeGetOutputLevelDb
//  These are called from the UI thread for VU meter display.
//  AudioEngine stores them in atomic<float> — safe to read here.
// ============================================================
JNI_FUNC(nativeGetInputLevelDb)(JNIEnv* /*env*/, jobject /*thiz*/) -> jfloat {
    return gPlayer ? gPlayer->dspEngine().inputLevelDb() : -96.f;
}

JNI_FUNC(nativeGetOutputLevelDb)(JNIEnv* /*env*/, jobject /*thiz*/) -> jfloat {
    return gPlayer ? gPlayer->dspEngine().outputLevelDb() : -96.f;
}
