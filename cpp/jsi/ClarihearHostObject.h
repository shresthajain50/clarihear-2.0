#pragma once
// ============================================================
//  ClarihearHostObject.h  —  JSI HostObject (Phase 4)
//  This C++ object is directly accessible from JavaScript as
//  `global.clarihear` — no serialisation, no async queue.
//
//  How JSI HostObjects work:
//    • jsi::HostObject is the C++ base class for "native objects"
//      that JavaScript can hold a reference to.
//    • When JS does `global.clarihear.setEqBandGain(2, 15, 20)`:
//        1. V8/Hermes calls ClarihearHostObject::get(rt, "setEqBandGain")
//        2. We return a jsi::Function created from a C++ lambda
//        3. Hermes calls that lambda with args [2, 15.0, 20.0]
//        4. Lambda calls _engine->setEqBandGain(2, 15.f, 20.f)
//        5. AudioEngine writes to a pending-value field (lock-free)
//        6. The audio thread picks up the new value on next callback
//    • Total latency of steps 1–6: < 1 microsecond
//    • Compare to legacy bridge: JSON serialise → async queue → ~16ms
//
//  Exposed JavaScript API (all synchronous unless noted):
//    clarihear.startAudio()                      → Promise<boolean>
//    clarihear.stopAudio()                       → void
//    clarihear.setMasterVolume(linear: number)   → void   ← sync
//    clarihear.setEqBandGain(b, gL, gR: number)  → void   ← sync ★
//    clarihear.setCompressorParams(params)        → void   ← sync
//    clarihear.setFeedbackSuppression(bool)       → void   ← sync
//    clarihear.applyAudiogram(left[], right[])    → void
//    clarihear.getInputLevel()                   → number ← sync
//    clarihear.getOutputLevel()                  → number ← sync
//
//  ★ setEqBandGain is the latency-critical method — called on every
//    slider drag frame (60fps). Its sub-microsecond cost is what makes
//    JSI mandatory for this use case.
// ============================================================

#pragma once
#include <jsi/jsi.h>
#include "../AudioEngine.h"

#include <memory>
#include <functional>

namespace clarihear {

// Forward declaration: platform-specific audio start/stop functions.
// On iOS:     these call [CoreAudioPlayer shared] start/stop
// On Android: these call the global OboeAudioPlayer singleton
using StartFn = std::function<bool()>;
using StopFn  = std::function<void()>;

// ============================================================
//  ClarihearHostObject
//  jsi::HostObject subclass — installed into the JS runtime once.
//  Lives for the app lifetime (owned by the runtime's GC via shared_ptr).
// ============================================================
class ClarihearHostObject : public facebook::jsi::HostObject {
public:
    // ── Constructor ─────────────────────────────────────────────────
    // engine:  raw pointer to the shared AudioEngine — never null after init
    // startFn: platform-specific audio start (requests mic permission, etc.)
    // stopFn:  platform-specific audio stop
    ClarihearHostObject(AudioEngine* engine,
                        StartFn     startFn,
                        StopFn      stopFn) noexcept
        : _engine(engine)
        , _startFn(std::move(startFn))
        , _stopFn(std::move(stopFn)) {}

    // ── jsi::HostObject interface ───────────────────────────────────
    // Called when JS reads any property on the `clarihear` global.
    // Returns a jsi::Function for known method names, undefined otherwise.
    facebook::jsi::Value get(
        facebook::jsi::Runtime& rt,
        const facebook::jsi::PropNameID& name) override;

    // set() — properties on clarihear are read-only from JS side
    void set(facebook::jsi::Runtime&,
             const facebook::jsi::PropNameID&,
             const facebook::jsi::Value&) override {}

    // getPropertyNames() — enables Object.keys(clarihear) from JS
    std::vector<facebook::jsi::PropNameID>
    getPropertyNames(facebook::jsi::Runtime& rt) override;

private:
    AudioEngine* _engine;   // non-owning raw pointer — AudioEngine outlives runtime
    StartFn      _startFn;
    StopFn       _stopFn;
};

// ============================================================
//  installClarihearHostObject
//  Called once at app startup to inject `global.clarihear` into the
//  JS runtime.
//
//  On iOS:     called from AppDelegate.mm after bridge initialises
//  On Android: called via JNI from ReactInstanceManager's listener
// ============================================================
void installClarihearHostObject(facebook::jsi::Runtime& runtime,
                                AudioEngine*            engine,
                                StartFn                 startFn,
                                StopFn                  stopFn);

} // namespace clarihear
